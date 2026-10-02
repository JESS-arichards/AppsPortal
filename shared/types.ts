// Types shared by the React client (src/) and the Express server (server/).

export interface CoreValue {
  text: string;
  /** null = default diamond; a short emoji/symbol; or a data:image/... URL */
  icon?: string | null;
}

export interface PortalBranding {
  id: number;
  mainColor: string;
  accentColor: string;
  textColor: string;
  navBgColor?: string | null;
  navTextColor?: string | null;
  heroBgColor?: string | null;
  heroTextColor?: string | null;
  navLogo?: string | null;
  favicon?: string | null;
  updatedAt?: string;
}

export interface PortalHomeContent {
  id: number;
  heroLabel: string;
  heroHeadline: string;
  heroIntro: string;
  heroImage?: string | null;
  heroImageAlt: string;
  captionName: string;
  captionRole: string;
  welcomeLabel: string;
  welcomeHeading: string;
  welcomeMessage: string;
  updatedAt?: string;
}

export interface PortalLoginContent {
  id: number;
  welcomeHeadline: string;
  valuesJson: string; // JSON array of CoreValue
  signInHeading: string;
  signInIntro: string;
  staffChoiceTitle: string;
  staffChoiceDescription: string;
  parentChoiceTitle: string;
  parentChoiceDescription: string;
  parentEmailLabel: string;
  parentCodeLabel: string;
  sendCodeLabel: string;
  verifyCodeLabel: string;
  resendCodeLabel: string;
  helpPrompt: string;
  helpLinkText: string;
  updatedAt?: string;
}
