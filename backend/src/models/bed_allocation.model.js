/**
 * Bed Allocation Model
 * Manages hospital bed assignments
 */

const pool = require('../config/db');
const logger = require('../utils/logger');

class BedAllocationModel {
    /**
     * Allocate a bed to a visit
     * @param {Object} allocationData - Allocation data
     * @returns {Promise<Object>} Created allocation
     */
    static async allocateBed({visitId,ward,room,bed,bedType,allocatedBy,notes}) {
        for (const value of [ward,room,bed]) if (typeof value !== 'string' || !value.trim() || value.length>100) throw Object.assign(new Error('Ward, room and bed are required'),{statusCode:400});
        try {
            return await pool.transaction(async client => {
                const visit = (await client.query('SELECT organization_id FROM visits WHERE id=$1 FOR UPDATE',[visitId])).rows[0];
                if (!visit) throw Object.assign(new Error('Visit not found'),{statusCode:404});
                const existing = await client.query("SELECT id FROM bed_allocations WHERE visit_id=$1 AND status='occupied'",[visitId]);
                if (existing.rows.length) throw Object.assign(new Error('Visit already has an occupied bed'),{statusCode:409});
                const result = await client.query(`INSERT INTO bed_allocations(visit_id,organization_id,ward,room,bed,bed_type,allocated_by,notes)
                    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[visitId,visit.organization_id,ward.trim(),room.trim(),bed.trim(),bedType,allocatedBy,notes]);
                return result.rows[0];
            });
        } catch (error) {
            if (error.code==='23505') throw Object.assign(new Error('Bed is already occupied'),{statusCode:409});
            throw error;
        }
    }

    /**
     * Release a bed
     * @param {String} allocationId - Allocation ID
     * @param {String} releasedBy - User ID
     * @returns {Promise<Object>} Updated allocation
     */
    static async releaseBed(allocationId, releasedBy) {
        try {
            const query = `
                UPDATE bed_allocations
                SET status = 'released',
                    released_at = NOW(),
                    released_by = $1,
                    updated_at = NOW()
                WHERE id = $2 AND status = 'occupied'
                RETURNING *
            `;

            const result = await pool.query(query, [releasedBy, allocationId]);

            if (result.rows.length === 0) {
                throw new Error('Allocation not found or already released');
            }

            logger.info('Bed released', {
                allocationId,
                releasedBy
            });

            return result.rows[0];
        } catch (error) {
            logger.error('Failed to release bed:', error);
            throw error;
        }
    }

    /**
     * Check if a bed is available
     * @param {String} ward - Ward name
     * @param {String} room - Room number
     * @param {String} bed - Bed number
     * @returns {Promise<Boolean>} True if available
     */
    static async isBedAvailable(ward,room,bed,organizationId) {
        if (!organizationId) throw new Error('Organization scope is required');
        const result = await pool.query("SELECT id FROM bed_allocations WHERE organization_id=$1 AND ward=$2 AND room=$3 AND bed=$4 AND status='occupied'",[organizationId,ward,room,bed]);
        return result.rows.length===0;
    }

    /**
     * Get available beds in a ward
     * @param {String} ward - Ward name
     * @param {String} bedType - Optional bed type filter
     * @returns {Promise<Array>} Available beds
     */
    static async getAvailableBeds(ward = null,bedType = null,organizationId) {
        if (!organizationId) throw new Error('Organization scope is required');
        const result = await pool.query(`SELECT DISTINCT ba.ward,ba.room,ba.bed,ba.bed_type FROM bed_allocations ba
            WHERE ba.organization_id=$1 AND ba.status='released' AND ($2::text IS NULL OR ba.ward=$2) AND ($3::text IS NULL OR ba.bed_type=$3)
            AND NOT EXISTS (SELECT 1 FROM bed_allocations occupied WHERE occupied.organization_id=ba.organization_id
                AND occupied.ward=ba.ward AND occupied.room=ba.room AND occupied.bed=ba.bed AND occupied.status='occupied')
            ORDER BY ba.ward,ba.room,ba.bed`,[organizationId,ward||null,bedType||null]);
        return result.rows;
    }

    /**
     * Get current bed allocation for a visit
     * @param {String} visitId - Visit ID
     * @returns {Promise<Object>} Current allocation
     */
    static async getVisitAllocation(visitId) {
        try {
            const query = `
                SELECT *
                FROM bed_allocations
                WHERE visit_id = $1 AND status = 'occupied'
                ORDER BY allocated_at DESC
                LIMIT 1
            `;

            const result = await pool.query(query, [visitId]);
            return result.rows[0];
        } catch (error) {
            logger.error('Failed to get visit allocation:', error);
            throw error;
        }
    }

    /**
     * Transfer patient to a different bed
     * @param {String} visitId - Visit ID
     * @param {Object} newBedData - New bed data
     * @param {String} transferredBy - User ID
     * @returns {Promise<Object>} New allocation
     */
    static async transferBed(visitId, newBedData, transferredBy) {
        try {
            // Release current bed
            const currentQuery = `
                UPDATE bed_allocations
                SET status = 'released',
                    released_at = NOW(),
                    released_by = $1,
                    updated_at = NOW()
                WHERE visit_id = $2 AND status = 'occupied'
                RETURNING id
            `;

            await pool.query(currentQuery, [transferredBy, visitId]);

            // Allocate new bed
            const newAllocation = await this.allocateBed({
                visitId,
                ward: newBedData.ward,
                room: newBedData.room,
                bed: newBedData.bed,
                bedType: newBedData.bedType,
                allocatedBy: transferredBy,
                notes: 'Transferred from another bed'
            });

            logger.info('Patient transferred to new bed', {
                visitId,
                newBed: `${newBedData.ward}-${newBedData.room}-${newBedData.bed}`
            });

            return newAllocation;
        } catch (error) {
            logger.error('Failed to transfer bed:', error);
            throw error;
        }
    }

    /**
     * Get ward occupancy summary
     * @param {String} ward - Ward name
     * @returns {Promise<Object>} Occupancy summary
     */
    static async getWardOccupancy(ward) {
        try {
            const query = `
                SELECT 
                    COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
                    COUNT(*) FILTER (WHERE status = 'released') as available,
                    COUNT(*) FILTER (WHERE status = 'cleaning') as cleaning,
                    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance
                FROM bed_allocations
                WHERE ward = $1
            `;

            const result = await pool.query(query, [ward]);
            return result.rows[0];
        } catch (error) {
            logger.error('Failed to get ward occupancy:', error);
            throw error;
        }
    }
}

module.exports = BedAllocationModel;
