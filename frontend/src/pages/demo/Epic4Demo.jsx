import React from 'react';
import { Link } from 'react-router-dom';
import NotificationCenter from '../../components/common/NotificationCenter';
import VisitLifecycle from '../../components/visit/VisitLifecycle';
import StaffAssignment from '../../components/visit/StaffAssignment';
import BedAllocation from '../../components/visit/BedAllocation';
import LabRequest from '../../components/workflow/LabRequest';
import ImagingRequest from '../../components/workflow/ImagingRequest';
import './Epic4Demo.css';

function Epic4Demo() {
    return (
        <div className="epic4-demo-page">
            {/* Demo Header with Notification Center */}
            <div className="demo-header">
                <div>
                    <h1>Epic 4: Clinical Visit & Workflow Management</h1>
                    <p>Demo Page - All Components Showcase</p>
                </div>
                <NotificationCenter />
            </div>

            {/* Navigation */}
            <div className="demo-nav">
                <a href="#lifecycle">Visit Lifecycle</a>
                <a href="#staff">Staff Assignment</a>
                <a href="#lab">Lab Request</a>
                <a href="#imaging">Imaging Request</a>
                <a href="#beds">Bed Allocation</a>
                <Link to="/visit/demo">Visit Dashboard</Link>
            </div>

            {/* Component Sections */}
            <div className="demo-content">
                {/* Visit Lifecycle */}
                <section id="lifecycle" className="demo-section">
                    <h2>1. Visit Lifecycle Timeline</h2>
                    <p className="section-desc">Visual representation of visit status progression</p>
                    <div className="component-wrapper">
                        <VisitLifecycle
                            currentStatus="ACTIVE"
                            timestamps={{
                                SCHEDULED: '2024-02-05T10:00:00',
                                CHECKED_IN: '2024-02-05T09:55:00',
                                ACTIVE: '2024-02-05T10:05:00',
                            }}
                        />
                    </div>
                </section>

                {/* Staff Assignment */}
                <section id="staff" className="demo-section">
                    <h2>2. Staff Assignment</h2>
                    <p className="section-desc">Assign healthcare staff to visits with role filtering</p>
                    <div className="component-wrapper">
                        <StaffAssignment
                            visitId="V-2024-001"
                            onAssign={(staffId) => undefined}
                            onRemove={(staffId) => undefined}
                        />
                    </div>
                </section>

                {/* Lab Request */}
                <section id="lab" className="demo-section">
                    <h2>3. Laboratory Test Request</h2>
                    <p className="section-desc">Order lab tests with priority and special instructions</p>
                    <div className="component-wrapper">
                        <LabRequest
                            visitId="V-2024-001"
                            patientId="P12345"
                            onSuccess={() => alert('Lab request submitted!')}
                            onCancel={() => undefined}
                        />
                    </div>
                </section>

                {/* Imaging Request */}
                <section id="imaging" className="demo-section">
                    <h2>4. Imaging/Radiology Request</h2>
                    <p className="section-desc">Order imaging studies with clinical indication</p>
                    <div className="component-wrapper">
                        <ImagingRequest
                            visitId="V-2024-001"
                            patientId="P12345"
                            onSuccess={() => alert('Imaging request submitted!')}
                            onCancel={() => undefined}
                        />
                    </div>
                </section>

                {/* Bed Allocation */}
                <section id="beds" className="demo-section full-width">
                    <h2>5. Bed Allocation Management</h2>
                    <p className="section-desc">Manage inpatient bed assignments and ward occupancy</p>
                    <div className="component-wrapper">
                        <BedAllocation
                            onAssign={(bedId) => alert(`Patient assigned to ${bedId}`)}
                            onDischarge={(bedId, patientId) => alert(`Patient ${patientId} discharged from ${bedId}`)}
                            onTransfer={(bedId, patientId) => alert(`Transfer patient ${patientId} from ${bedId}`)}
                        />
                    </div>
                </section>
            </div>

            {/* Info Box */}
            <div className="demo-info">
                <h3>💡 About These Components</h3>
                <ul>
                    <li><strong>NotificationCenter:</strong> Click the bell icon in the header to see notifications</li>
                    <li><strong>Visit Dashboard:</strong> Click the "Visit Dashboard" link above to see the full dashboard</li>
                    <li><strong>Interactive:</strong> All forms and buttons are functional with mock data</li>
                    <li><strong>Responsive:</strong> Resize your browser to see mobile/tablet views</li>
                    <li><strong>Theme Consistent:</strong> All components use the medical blue theme</li>
                </ul>
            </div>
        </div>
    );
}

export default Epic4Demo;
