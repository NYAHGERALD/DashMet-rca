# Microsoft Login Setup Guide

This document provides step-by-step instructions for configuring Microsoft OAuth login for the DashMet Operations Intelligence.

## Overview

The Microsoft login integration supports:
- ✅ **Personal Microsoft Accounts** (outlook.com, hotmail.com, live.com)
- ✅ **Work Accounts** (Azure AD / Microsoft Entra ID organizational accounts)
- ✅ **School Accounts** (Microsoft 365 Education accounts)

## Architecture

The Microsoft login uses Firebase Authentication as the identity broker:

```
User → Microsoft Login Button → Firebase Auth (OAuthProvider) → Microsoft Identity Platform → Firebase ID Token → Your Backend
```

**Key Benefits:**
- No direct integration with Azure AD required on your backend
- Firebase handles token exchange and security
- Your existing auth middleware works automatically
- Single sign-on (SSO) for enterprise customers

---

## Step 1: Enable Microsoft Provider in Firebase Console

### 1.1 Navigate to Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: **dashmet-resolve-1ce6d**
3. Navigate to **Build** → **Authentication** → **Sign-in method**

### 1.2 Enable Microsoft Provider

1. Click on **Microsoft** in the provider list
2. Toggle **Enable** to ON
3. You will see two fields that need configuration:
   - **Application (client) ID** - From Azure AD
   - **Application (client) secret** - From Azure AD

> ⚠️ **Keep this page open** - You will need the callback URL shown here for Azure configuration

The callback URL will look like:
```
https://dashmet-resolve-1ce6d.firebaseapp.com/__/auth/handler
```

---

## Step 2: Register App in Microsoft Azure Portal

### 2.1 Access Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Sign in with your Microsoft account (any account type works)

### 2.2 Navigate to App Registrations

1. Search for **"App registrations"** in the top search bar
2. Or navigate to: **Azure Active Directory** → **App registrations**
3. Click **+ New registration**

### 2.3 Register the Application

Fill in the registration form:

| Field | Value |
|-------|-------|
| **Name** | `DashMet Operations Intelligence` (or your preferred name) |
| **Supported account types** | **Accounts in any organizational directory and personal Microsoft accounts** |
| **Redirect URI (optional)** | Leave empty for now (we'll add it next) |

> 🔑 **Important:** Choose "Accounts in any organizational directory AND personal Microsoft accounts" to support all account types.

Click **Register** to create the application.

### 2.4 Copy Application (Client) ID

After registration, you'll be on the app overview page:

1. Copy the **Application (client) ID** (a UUID like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
2. Save this - you'll need it for Firebase Console

---

## Step 3: Configure Redirect URI

### 3.1 Add Firebase Callback URL

1. In your Azure App Registration, go to **Authentication** in the left sidebar
2. Click **+ Add a platform**
3. Select **Web**
4. Enter the Redirect URI from Firebase Console:
   ```
   https://dashmet-resolve-1ce6d.firebaseapp.com/__/auth/handler
   ```
5. Click **Configure**

### 3.2 Configure Additional Settings

Still on the Authentication page:

1. Under **Implicit grant and hybrid flows**, check:
   - ✅ **Access tokens** (for implicit flows)
   - ✅ **ID tokens** (for implicit and hybrid flows)

2. Under **Supported account types**, ensure:
   - ✅ **Accounts in any organizational directory and personal Microsoft accounts** is selected

3. Click **Save**

---

## Step 4: Create Client Secret

### 4.1 Generate Secret

1. Go to **Certificates & secrets** in the left sidebar
2. Under **Client secrets**, click **+ New client secret**
3. Add a description: `Firebase Auth Secret`
4. Select expiration: **24 months** (recommended) or custom
5. Click **Add**

### 4.2 Copy the Secret Value

> ⚠️ **CRITICAL:** Copy the **Value** (not the Secret ID) immediately! It will only be shown once.

The value looks like: `xxxxxxxx~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**Store this securely** - you cannot retrieve it later.

---

## Step 5: Configure API Permissions

### 5.1 Required Permissions

1. Go to **API permissions** in the left sidebar
2. You should see `User.Read` already added by default
3. If not present, click **+ Add a permission**:
   - Select **Microsoft Graph**
   - Select **Delegated permissions**
   - Add these permissions:
     - ✅ `openid`
     - ✅ `profile`
     - ✅ `email`
     - ✅ `User.Read`

4. Click **Add permissions**

### 5.2 Grant Admin Consent (Optional)

If you're an Azure AD admin and want to pre-approve these permissions:
- Click **Grant admin consent for [Your Organization]**
- This prevents users from seeing consent prompts

> 💡 For personal Microsoft accounts, users will always see a consent prompt on first login.

---

## Step 6: Complete Firebase Configuration

### 6.1 Enter Credentials in Firebase

Go back to the Firebase Console (Authentication → Sign-in method → Microsoft):

1. Enter the **Application (client) ID** you copied in Step 2.4
2. Enter the **Client secret value** you copied in Step 4.2
3. Click **Save**

### 6.2 Add Authorized Domains (if needed)

In Firebase Console → Authentication → Settings → Authorized domains:

Ensure these domains are listed:
- `localhost` (for development)
- `dashmet-resolve-1ce6d.firebaseapp.com`
- `dashmet-resolve-1ce6d.web.app`
- Your production domain (e.g., `your-domain.com`)

---

## Step 7: Test the Integration

### 7.1 Development Testing

1. Start your development server:
   ```bash
   cd frontend && npm run dev
   ```

2. Navigate to `http://localhost:3000/login`

3. Click **Continue with Microsoft**

4. You should see Microsoft's login screen with options:
   - Personal account (outlook.com, etc.)
   - Work or school account

5. After successful login:
   - New users → Redirected to `/profile-setup`
   - Existing users → Redirected to `/dashboard`

### 7.2 Common Test Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| New Microsoft user | Redirect to profile setup |
| Existing user (first Microsoft login) | Account linked, redirect to dashboard |
| Same email, different provider | Error: "Account exists with different credential" |
| Popup blocked | Clear error message shown |
| User cancels login | "Sign-in cancelled" message |

---

## Troubleshooting

### Error: "The redirect URI is not valid"

**Solution:** Ensure the redirect URI in Azure exactly matches Firebase's callback URL:
```
https://dashmet-resolve-1ce6d.firebaseapp.com/__/auth/handler
```
Note: No trailing slash!

### Error: "auth/operation-not-allowed"

**Solution:** 
1. Verify Microsoft provider is enabled in Firebase Console
2. Check that Client ID and Secret are entered correctly
3. Ensure there are no extra spaces in the credentials

### Error: "auth/account-exists-with-different-credential"

**Explanation:** The email is already registered with another provider (Google or email/password).

**User Resolution:** 
1. Sign in with the original provider first
2. Link Microsoft account in profile settings (if you implement account linking)

### Error: "AADSTS50011: The reply URL does not match"

**Solution:** 
1. Go to Azure Portal → App Registration → Authentication
2. Verify the redirect URI exactly matches Firebase's
3. Check for http vs https mismatch
4. Ensure no trailing slash

### Error: "AADSTS7000218: The request body must contain: client_assertion or client_secret"

**Solution:**
1. Check that the client secret hasn't expired in Azure
2. Regenerate the secret and update in Firebase Console

---

## Security Best Practices

### 1. Client Secret Management

- ⏰ Set calendar reminder 30 days before secret expiration
- 🔄 Rotate secrets annually (create new before deleting old)
- 🔒 Never commit secrets to version control

### 2. Tenant Configuration

The current configuration uses `tenant: 'common'` which allows:
- Personal Microsoft accounts
- Any organizational account

For enterprise-only apps, you can restrict to:
```typescript
microsoftProvider.setCustomParameters({
  tenant: 'organizations',  // Work/School accounts only
  prompt: 'select_account',
});
```

Or for a specific organization:
```typescript
microsoftProvider.setCustomParameters({
  tenant: 'your-tenant-id.onmicrosoft.com',
  prompt: 'select_account',
});
```

### 3. MFA Considerations

Microsoft Entra ID (Azure AD) can enforce MFA at the organizational level. This works seamlessly with Firebase Auth - users complete MFA during Microsoft login.

---

## Enterprise Deployment Checklist

Before going to production:

- [ ] Client secret has 24-month expiration
- [ ] Secret rotation reminder set in calendar
- [ ] Production domain added to Firebase authorized domains
- [ ] Production domain added to Azure redirect URIs
- [ ] Tested with personal, work, and school accounts
- [ ] Error handling tested for all edge cases
- [ ] Admin consent granted (if required by enterprise policy)

---

## Files Modified

The following files were updated to add Microsoft login:

| File | Changes |
|------|---------|
| [frontend/src/lib/firebase.ts](frontend/src/lib/firebase.ts) | Added `microsoftProvider` with OAuth configuration |
| [frontend/src/app/login/page.tsx](frontend/src/app/login/page.tsx) | Added Microsoft login button and handler |
| [frontend/src/app/page.tsx](frontend/src/app/page.tsx) | Added Microsoft login button and handler on landing page |

---

## Support

If you encounter issues:

1. Check the browser console for detailed error messages
2. Review Firebase Authentication logs in Firebase Console
3. Check Azure AD sign-in logs in Azure Portal
4. Refer to the troubleshooting section above

For Firebase-specific issues: [Firebase Auth Troubleshooting](https://firebase.google.com/docs/auth/web/microsoft-oauth)

For Azure-specific issues: [Microsoft Identity Platform Documentation](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
