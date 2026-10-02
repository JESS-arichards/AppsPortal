// Single source of default branding and page content. Used by the in-memory store and as the
// client's initial state before the API responds. database/schema.sql column DEFAULTs must match
// (enforced by tests/defaults.test.ts).
import type { CoreValue, PortalBranding, PortalHomeContent, PortalLoginContent } from './types.js';

export const DEFAULT_CORE_VALUES: CoreValue[] = [
  'Commitment', 'Respect', 'Excellence', 'Care', 'Integrity', 'Curiosity',
].map(text => ({ text, icon: null }));

export const DEFAULT_BRANDING: PortalBranding = {
  id: 1,
  mainColor: '#002B49',
  accentColor: '#BA9B37',
  textColor: '#212529',
  navBgColor: null,
  navTextColor: null,
  heroBgColor: null,
  heroTextColor: null,
  navLogo: null,
  favicon: null,
};

export const DEFAULT_HOME_CONTENT: PortalHomeContent = {
  id: 1,
  heroLabel: 'Welcome to JESS Dubai',
  heroHeadline: 'Excellence, Empowerment and Purpose',
  heroIntro: 'Empowering our community through innovative digital education and streamlined school services.',
  heroImage: null,
  heroImageAlt: 'JESS Dubai Campus',
  captionName: 'JESS Leadership Team',
  captionRole: 'Executive Office',
  welcomeLabel: 'Our Community',
  welcomeHeading: 'Welcome to the JESS Enterprise Portal',
  welcomeMessage: 'Welcome to the JESS Dubai Enterprise Portal.\n\nThis unified platform provides staff, students, and parents with secure, direct access to essential services including distance learning schedules, staff parking management, attendance tracking, and live school event streaming.\n\nPlease use the navigation menu above to access your authorised services.',
};

export const DEFAULT_LOGIN_CONTENT: PortalLoginContent = {
  id: 1,
  welcomeHeadline: 'Welcome to the School Community Portal',
  valuesJson: JSON.stringify(DEFAULT_CORE_VALUES),
  signInHeading: 'Sign in to JESS Portal',
  signInIntro: 'Choose your login method below to access school services.',
  staffChoiceTitle: 'Staff & Students',
  staffChoiceDescription: 'Sign in with your official school Microsoft account.',
  parentChoiceTitle: 'Parents & Guardians',
  parentChoiceDescription: 'Access your parent account using a secure one-time verification code.',
  parentEmailLabel: 'Registered Parent Email Address',
  parentCodeLabel: '6-Digit One-Time Verification Code',
  sendCodeLabel: 'Send Verification Code',
  verifyCodeLabel: 'Verify and Continue',
  resendCodeLabel: 'Resend Code',
  helpPrompt: 'Need assistance accessing your account?',
  helpLinkText: 'Contact JESS IT Helpdesk',
};
