export type DashMetUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string | null;
  theme?: string;
  language?: string;
  timezone?: string;
};

export type MobileSession = {
  accessToken: string;
  refreshToken: string;
  user: DashMetUser;
};

export type SessionResponse =
  | {
      success: true;
      requiresEmailVerification: false;
      data: MobileSession;
    }
  | {
      success: true;
      requiresEmailVerification: true;
      message: string;
    };
