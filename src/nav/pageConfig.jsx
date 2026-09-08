import { IcGrid, IcDoc, IcReq, IcIss, IcUser, IcRcd, IcFund, IcAct, IcRaaf, IcCraaf } from '../components/icons.jsx';

export const PAGE_META = {
  dashboard:      { t: 'Dashboard',          s: 'System overview and accountable form stub status' },
  activities:     { t: 'Activities',         s: 'Full log of system activity' },
  forms:          { t: 'Form Inventory',     s: 'Manage accountable forms and stub stock' },
  requests:       { t: 'Requests',           s: 'Review and process form requests' },
  issuances:      { t: 'Issuances',          s: 'Track all issued accountable forms' },
  'all-rcds':     { t: 'All RCDs',           s: 'View every Report on Collections & Deposits filed by all users' },
  'all-raaf':     { t: 'All RAAF',           s: "View every user's RAAF" },
  craaf:          { t: 'CRAAF',              s: 'Generate and manage the Consolidated Report of Accountability for Accountable Forms (CRAAF)' },
  users:          { t: 'User Accounts',      s: 'Manage user accounts' },
  designations:   { t: 'Designations',       s: 'Manage the list of designations assignable to user accounts' },
  funds:          { t: 'Funds',              s: 'Manage the list of funds available for Official Receipts' },
  'my-requests':  { t: 'My Requests',        s: 'View and submit your form requests' },
  'my-issuances': { t: 'Forms Issued to Me', s: 'View forms issued to you and set the fund for each' },
  'my-rcds':      { t: 'Report on Collections & Deposits', s: 'Report OR series used and their collected amounts' },
  'my-raaf':      { t: 'Report of Accountability for Accountable Forms', s: 'Generate and manage your monthly RAAF for forms issued to you' },
};

// badge(g) receives the DataContext `g` getter so it can compute live counts.
export function getNavCfg() {
  return {
    Admin: [
      { sec: 'Dashboard', items: [
        { id: 'dashboard', label: 'Dashboard', ic: IcGrid },
        { id: 'activities', label: 'Activities', ic: IcAct },
      ] },
      { sec: 'Management', items: [
        { id: 'forms', label: 'Form Inventory', ic: IcDoc },
        { id: 'requests', label: 'Requests', ic: IcReq, badge: g => g('requests').filter(r => r.status === 'Pending').length },
        { id: 'issuances', label: 'Issuances', ic: IcIss },
        { id: 'all-rcds', label: 'All RCDs', ic: IcRcd, badge: g => g('rcds').filter(r => !r.completed).length },
        { id: 'all-raaf', label: 'All RAAF', ic: IcRaaf },
        { id: 'craaf', label: 'CRAAF', ic: IcCraaf },
        { id: 'users', label: 'Users', ic: IcUser },
        { id: 'designations', label: 'Designations', ic: IcUser },
        { id: 'funds', label: 'Funds', ic: IcFund },
      ] },
    ],
    User: [
      { sec: 'My Account', items: [
        { id: 'my-requests', label: 'My Requests', ic: IcReq },
        { id: 'my-issuances', label: 'Forms Issued to Me', ic: IcIss },
        { id: 'my-rcds', label: 'My RCDs', ic: IcRcd },
        { id: 'my-raaf', label: 'RAAF', ic: IcRaaf },
      ] },
    ],
  };
}
