import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import ReactPDFDefault, { renderToBuffer } from "@react-pdf/renderer";
import { fileURLToPath } from "node:url";
const { Document, Page, View, Text, Image, StyleSheet } = ReactPDFDefault;
const signatureImagePath = fileURLToPath(new URL("../../../assets/signature.png", import.meta.url));
const styles = StyleSheet.create({
    page: {
        padding: 34,
        fontSize: 9,
        fontFamily: "Helvetica",
        color: "#242724",
        lineHeight: 1.35,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        borderBottom: "2pt solid #242724",
        paddingBottom: 8,
    },
    brand: {
        fontSize: 16,
        fontFamily: "Helvetica-Bold",
    },
    brandSub: {
        fontSize: 6.5,
        color: "#737870",
        marginTop: 8,
    },
    headerContact: {
        fontSize: 7.5,
        color: "#737870",
        textAlign: "right",
    },
    section: { marginTop: 11 },
    salutationSection: { marginTop: 22 },
    paymentsSection: { marginTop: 18 },
    sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5 },
    muted: { color: "#737870" },
    spaced: { marginTop: 6 },
    table: {
        marginTop: 5,
        border: "1pt solid #cfd4cb",
        borderRadius: 0,
    },
    tableRow: {
        flexDirection: "row",
        borderBottom: "1pt solid #e2e5df",
    },
    tableRowLast: {
        flexDirection: "row",
    },
    tableLabelCell: {
        width: "34%",
        backgroundColor: "#f3f5f1",
        padding: 5,
        fontFamily: "Helvetica-Bold",
    },
    tableValueCell: {
        width: "66%",
        padding: 5,
    },
    paymentsTable: {
        marginTop: 5,
        border: "1pt solid #cfd4cb",
        borderRadius: 0,
        flexDirection: "row",
    },
    paymentsCol: {
        flex: 1,
        borderLeft: "1pt solid #e2e5df",
    },
    paymentsColFirst: {
        flex: 1,
    },
    paymentsHeader: {
        backgroundColor: "#f3f5f1",
        padding: 5,
        fontFamily: "Helvetica-Bold",
        fontSize: 7,
        textAlign: "center",
    },
    paymentsValue: {
        padding: 5,
        textAlign: "center",
        fontSize: 9.5,
    },
    signatureBlock: { marginTop: 40, alignItems: "flex-end" },
    signatureContainer: { width: 150, alignItems: "center" },
    signatureImage: {
        width: 90,
        height: 30,
        objectFit: "contain",
        marginBottom: 3,
    },
    signatureLine: {
        borderTop: "1pt solid #242724",
        width: 150,
        paddingTop: 3,
    },
    signatureLineName: { fontFamily: "Helvetica-Bold" },
    footer: {
        marginTop: 14,
        borderTop: "1pt solid #e2e5df",
        paddingTop: 8,
    },
    footerTitle: { fontFamily: "Helvetica-Bold", fontSize: 7.5, marginBottom: 3 },
    footerText: { fontSize: 7, color: "#737870", lineHeight: 1.3 },
});
const formatCurrency = (value) => `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})} USD`;
const formatLongDate = (date) => date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
});
function ProfileRow({ label, value, last, }) {
    return (_jsxs(View, { style: last ? styles.tableRowLast : styles.tableRow, children: [_jsx(View, { style: styles.tableLabelCell, children: _jsx(Text, { children: label }) }), _jsx(View, { style: styles.tableValueCell, children: _jsx(Text, { children: value }) })] }));
}
function EarningsCertificateDocument({ data, }) {
    return (_jsx(Document, { title: `OneMarketplace.io Earnings Certificate - ${data.freelancerName}`, author: "OneMinute Stack Inc.", children: _jsxs(Page, { size: "LETTER", style: styles.page, children: [_jsxs(View, { style: styles.headerRow, children: [_jsxs(View, { children: [_jsx(Text, { style: styles.brand, children: "OneMarketplace.io" }), _jsx(Text, { style: styles.brandSub, children: "A product of OneMinute Stack Inc." })] }), _jsxs(View, { style: styles.headerContact, children: [_jsx(Text, { children: "Tel +1 (555) 000-0000" }), _jsx(Text, { children: "www.onemarketplace.io" })] })] }), _jsxs(View, { style: styles.section, children: [_jsx(Text, { children: formatLongDate(data.issuedAt) }), _jsx(Text, { style: [styles.muted, styles.spaced], children: "16192 Coastal Highway," }), _jsx(Text, { style: styles.muted, children: "Lewes, Delaware 19958, USA" })] }), _jsxs(View, { style: styles.salutationSection, children: [_jsx(Text, { children: "To Whom It May Concern," }), _jsxs(Text, { style: styles.spaced, children: ["This letter is to provide documentation of earnings to", " ", data.freelancerName, ", who is an independent contractor performing services as a freelancer for third-party client companies through OneMarketplace.io. OneMarketplace.io provides an online workplace where companies hire, manage, and pay freelancers through our web-based platform."] }), _jsxs(Text, { style: styles.spaced, children: ["While OneMarketplace.io is not the employer of ", data.freelancerName, " ", "and does not control their ongoing earnings on the platform, we can confirm that ", data.freelancerName, " has been paid the following amounts as an independent contractor."] })] }), _jsxs(View, { style: styles.section, children: [_jsx(Text, { style: styles.sectionTitle, children: "Freelancer profile" }), _jsxs(View, { style: styles.table, children: [_jsx(ProfileRow, { label: "Name", value: data.freelancerName }), _jsx(ProfileRow, { label: "Title", value: data.professionalTitle }), _jsx(ProfileRow, { label: "OneMarketplace.io Profile URL", value: data.profileUrl }), _jsx(ProfileRow, { label: "Active on OneMarketplace.io Since", value: formatLongDate(data.activeSince) }), _jsx(ProfileRow, { label: "Location", value: data.location, last: true })] })] }), _jsxs(View, { style: styles.paymentsSection, children: [_jsx(Text, { style: styles.sectionTitle, children: "Service contract payments received" }), _jsx(View, { style: styles.paymentsTable, children: data.windows.map((window, index) => (_jsxs(View, { style: index === 0 ? styles.paymentsColFirst : styles.paymentsCol, children: [_jsx(Text, { style: styles.paymentsHeader, children: window.label }), _jsx(Text, { style: styles.paymentsValue, children: formatCurrency(window.total) })] }, index))) })] }), _jsxs(View, { style: styles.section, children: [_jsx(Text, { style: styles.sectionTitle, children: "OneMarketplace.io Certification" }), _jsx(Text, { style: styles.spaced, children: "This Statement of Earnings is issued upon the request of the above-named freelancer for reference purposes, and OneMarketplace.io certifies to the truthfulness and authenticity of the same on the basis of company records." })] }), _jsx(View, { style: styles.signatureBlock, children: _jsxs(View, { style: styles.signatureContainer, children: [_jsx(Image, { src: signatureImagePath, style: styles.signatureImage }), _jsxs(View, { style: styles.signatureLine, children: [_jsx(Text, { style: styles.signatureLineName, children: "Shahriar Sajeeb" }), _jsx(Text, { style: styles.muted, children: "Founder & Authorized Signatory," }), _jsx(Text, { style: styles.muted, children: "OneMinute Stack Inc." })] })] }) }), _jsxs(View, { style: styles.footer, children: [_jsx(Text, { style: styles.footerTitle, children: "About OneMinute Stack Inc." }), _jsx(Text, { style: styles.footerText, children: "OneMarketplace.io provides an online workplace where freelancers offer virtual services to companies across the globe. The individual named above is an independent contractor and not an employee of OneMinute Stack Inc. nor the clients to which they provide services. The freelancer offers their expertise to the public, using their own equipment and assets, and retains the possibility of profit and loss. OneMinute Stack Inc. does not control the freelancer's ongoing earnings. This statement confirms work performed by this freelancer for their clients through the OneMarketplace.io platform and is not a guarantee of future earnings." }), _jsxs(Text, { style: [styles.footerText, { marginTop: 8 }], children: ["\u00A9 ", data.issuedAt.getFullYear(), " OneMinute Stack Inc. All rights reserved."] })] })] }) }));
}
export const renderEarningsCertificatePdf = async (data) => renderToBuffer(_jsx(EarningsCertificateDocument, { data: data }));
//# sourceMappingURL=earnings-certificate.pdf.js.map