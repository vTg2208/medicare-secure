import React from 'react';
export const NOTICE_SECTIONS = {
    purposes:'Purposes',processingBasis:'Processing basis',dataCategories:'Data categories',
    recipients:'Recipients and providers',retention:'Retention and disposal',transfers:'Transfers',
    rights:'Patient rights',complaints:'Complaints',security:'Security boundaries',
};
export const noticeDate = value => value ? new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}) : 'Not recorded';
export default function NoticeContent({notice,preview=false}) {
    const content=notice.content;
    return <article className="privacy-panel notice-document" aria-label={preview?'Notice preview':'Published notice'}>
        <span className="privacy-eyebrow">{preview?'Preview — not published':`Version ${notice.versionNumber}`}</span>
        <h2>{content.title}</h2>
        {!preview&&<p className="privacy-hint">Published <time dateTime={notice.publishedAt}>{noticeDate(notice.publishedAt)}</time></p>}
        <p><strong>Responsible operator:</strong> {content.operatorName}</p>
        <p><strong>Privacy contact:</strong> <a href={`mailto:${encodeURIComponent(content.contactEmail)}`}>{content.contactEmail}</a></p>
        {Object.entries(content.sections).map(([key,value])=><section key={key}><h3>{NOTICE_SECTIONS[key]||key}</h3><p className="notice-section-text">{value}</p></section>)}
    </article>;
}
