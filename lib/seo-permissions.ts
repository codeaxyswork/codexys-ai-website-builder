export type SEORole = "owner" | "admin" | "editor" | "viewer" | "client";

export interface SEOPermissionCheck {
  canView: boolean;
  canExecuteFix: boolean;
  canRollback: boolean;
  canConfigureWhiteLabel: boolean;
  canGenerateReports: boolean;
}

/**
 * Deterministically evaluates user role permissions for SEO actions.
 */
export function getSEOPermissions(role: SEORole = "owner"): SEOPermissionCheck {
  switch (role) {
    case "owner":
    case "admin":
      return {
        canView: true,
        canExecuteFix: true,
        canRollback: true,
        canConfigureWhiteLabel: true,
        canGenerateReports: true,
      };
    case "editor":
      return {
        canView: true,
        canExecuteFix: true,
        canRollback: true,
        canConfigureWhiteLabel: false,
        canGenerateReports: true,
      };
    case "viewer":
    case "client":
    default:
      return {
        canView: true,
        canExecuteFix: false,
        canRollback: false,
        canConfigureWhiteLabel: false,
        canGenerateReports: false,
      };
  }
}
