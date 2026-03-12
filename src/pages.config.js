/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Analytics from './pages/Analytics';
import Attendance from './pages/Attendance';
import Communications from './pages/Communications';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Followups from './pages/Followups';
import Home from './pages/Home';
import MemberQRCode from './pages/MemberQRCode';
import Members from './pages/Members';
import MyPastoralCare from './pages/MyPastoralCare';
import MyProfile from './pages/MyProfile';
import PastoralCare from './pages/PastoralCare';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Profile from './pages/Profile';
import PublicMemberRegistration from './pages/PublicMemberRegistration';
import Transportation from './pages/Transportation';
import UserManagement from './pages/UserManagement';
import WSF from './pages/WSF';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Analytics": Analytics,
    "Attendance": Attendance,
    "Communications": Communications,
    "Dashboard": Dashboard,
    "Events": Events,
    "Followups": Followups,
    "Home": Home,
    "MemberQRCode": MemberQRCode,
    "Members": Members,
    "MyPastoralCare": MyPastoralCare,
    "MyProfile": MyProfile,
    "PastoralCare": PastoralCare,
    "PrivacyPolicy": PrivacyPolicy,
    "Profile": Profile,
    "PublicMemberRegistration": PublicMemberRegistration,
    "Transportation": Transportation,
    "UserManagement": UserManagement,
    "WSF": WSF,
}

export const pagesConfig = {
    mainPage: "MyProfile",
    Pages: PAGES,
    Layout: __Layout,
};