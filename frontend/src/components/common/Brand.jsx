import React from 'react';
import { Link } from 'react-router-dom';
import { brandName } from '../../config/brand';

/** The product mark stays identical across public, account and role screens. */
export default function Brand({ to = '/', className = '' }) {
    return (
        <Link to={to} className={`mc-brand ${className}`} aria-label={`${brandName} home`}>
            <img src="/medicare-icon.svg" alt="" width="40" height="40" />
            <span>{brandName}</span>
        </Link>
    );
}
