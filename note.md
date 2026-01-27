This interface should be redesigned to open as a full-width section or page, rather than a modal.

The Implementation Plan should be structured in a systematic, step-by-step format, instead of a single block of long-form text. Each implementation item should be represented as its own dedicated block or card, allowing for clarity, accountability, and traceability.

Each implementation block should include, at minimum, the following fields:

Action Description

Estimated Time to Complete

Responsible Party (who is accountable)

Timeline / Due Date

Ownership

Verification Method

Status / Progress

Additional Notes (optional)

The Action Description fields should support:

Manual user input

AI-assisted suggestions

AI validation to check for clarity, feasibility, and alignment with the root cause if Manual input is done.

The AI should act as an assistant and validator, not a replacement—users must retain full control to edit and finalize all content.

If this approach is acceptable, proceed with implementing it in a way that:

Maintains existing workflows and logic

Integrates seamlessly with the current application structure

Enhances usability without introducing disruption

What do you think? If this direction is approved, please implement using this approach.



===============================================

Apply the same full-width section approach to this area as well; it should not open as a modal. The section must expand into a dedicated, full-width workspace to support detailed documentation and review.

This section should include the following capabilities:

Evidence & Documentation

Enable file attachments directly within the section, allowing users to upload:

Photos of completed work

Supporting documents (PDFs, reports, forms, etc.)

On mobile devices, users must be able to:

Take photos instantly using the device camera

Attach those photos directly to the record

Allow users to add external links to supporting documentation or proof of completion

Deviation from Plan

Provide a manual input field where users can document any deviations from the original implementation plan

Include AI-assisted analysis that:

Reviews the deviation against the original plan

Identifies gaps, risks, or misalignment in an enterprise-level, professional manner

If the user enters deviations manually:

Provide an “AI Validate” button

Allow the AI to confirm, refine, or recommend adjustments based on the analyzed data

Lessons Learned

Include a Lessons Learned section with:

Manual input capability

AI-assisted analysis to extract meaningful insights from the incident, corrective actions, and outcomes

When lessons are manually entered:

Provide an AI validation option

Allow the AI to enhance clarity, relevance, and applicability based on all available data

General Requirements

All AI-generated or AI-assisted content must remain fully editable

AI must operate as an assistant and validator, not an automatic decision-maker

The implementation must maintain compatibility with existing logic, workflows, and data structures

This approach ensures the section supports verification, accountability, continuous improvement, and enterprise-grade learning, while preserving full user control.






I feel like the Auditing is not thorough, The AI should check the Answers provided by the users if the are good enough if not give recomendations. The Auditor should be thorough so that if any report is to be mark as CLOSED should pass any Audition from regulations. it Also analyse the evident attachment thoroughly to determine if it was enough to back up the report.


This does not meet our requirements check the requirement again. Modal should be bigger and resposive on mobile device screen. Implement a dynamic, animated AI validation modal that runs during the FMIR closing process. Behavior & Content
Display real-time, dynamic messages describing exactly what the AI is validating. These messages must be generated per FMIR report, based on the actual report data (not hardcoded).
Examples include checks on incident completeness, evidence integrity, category alignment, and compliance thresholds.
Messages should appear with smooth professional animations (fade, slide, or step-progress transitions) to clearly communicate progress without distracting the user.
Greeting & Context Section (Top of Modal)
At the top of the modal, display a personalized greeting:
“Hello {QA User Name},
I am your {Organization Name} Internal Auditor.
Please hang tight while I review your FMIR report to ensure it meets our audit standards.
This report must achieve a minimum compliance score of 98% to be eligible for closure and marked as Audit-Ready.”
The QA user name must reflect the current user performing the closing action. The organization name must be pulled dynamically from the active tenant context. Visual Engagement (Non-Static Content) Include a rotating slideshow or visual feed within the modal featuring: Relevant audit insights Real validation steps being performed Context-aware compliance indicators All visuals and messages must be data-driven and generated dynamically, not static or placeholder content.


Lets implement adding comments feature to all the sections. The users with role QA/Food Safety will be the ones adding comments for now. the should be a plus icon with the word comment on each section. when the QA user clicks on it a comment box pops down from the icon, and the QA user types the comment and clicks save. the comment is save in the database link to the section the comment will now have a comment icon which when click on it, it displays the comment as a hint,  and can click close button to minimize it back. The save comment should carry the name of the commentor, Date and time the comment was created.

Lets implement adding comments feature to all the sections. all colaborator including owners and QA can add comments on any section of a report. There should be a plus icon with the word comment on each section. when the a user clicks on it a comment slide bar  pops out form the right. The comment section have a select user to view comment dropdown. 1 or multiple users can be selected. the users available to be selected will be coloborators that are already added to the report. the user types the comment and clicks save. the comment is save in the database link to the section. The section with comment will now have a comment icon which when click on it, it displays the comment as a hint box. the hint comment box  will have a next and back arror botton if there are multiple comments for the section and users can click close button on the comment to minimize it back or click outside the comment hint to close it as well. The save comment should carry the name of the commentor when other users are view it, if the user is viewing their own comment it will show as owner then all comments will show Date and time the comment was created. when viewing comment, it show show the user's profile on the right top.

Implement this carefully without breaking other codes.
keep in mind that everything works in real time and does not need page refreah. do this professional


postgresql://postgres:iRvkScpLsNvIyVyastxaKJdmrmgSjZmS@maglev.proxy.rlwy.net:41384/railway



You see where code are being generated for Access to complete user profile. instead of generating code for all role except the Admin and System Admin, lets make the feature to be more secure by selecting the role we want to generate the 6 number code for and generate the Access Code that is link to that particullar role and can't be used for other roles within the organization.


users with Supervisor role from creating a foreign material report, but still the supervisor user still went ahead to click on the create foreign material button and they were allowed to perform that action. that is a security issue right there. We should have a standard modal that we can use each time a feature is triggered it checks whether that feature has previlege access if not it will trigger that our standard modal. the modal should contain user freindly message that respectectfull letting the user know that they do not have the previlege to perform that action and they can contact their Admin for access granting and a link for a support modal. or if there is a quicker and more effective approach that is more proffeissinal, you can do it as long it is not going to cause any  damage to our already working Application.
Do you understand?

Now lets implement a support feature for all user role sessions except the Admin and System Admin. the support link will be a floating Message button that is on the left below conner of the screen. it is always there no mather the page the user opens. the floating button should be bigger and visible. use green color. on the other end of the QC manager and QC manager is the recieving end. when user wants to sent a support request, they click on the button and the resizable and movable message modal opens up and the user either select the Admin or QC manager to sent their request in a from of a message. the message area accepts pasting of images like screen shot taken.

Please implement this with integrety, professionalism, carefulness, no rush to avoid mistakes, code written must be 100% know that it will work, no room for errors, dont't break existing logics and frow, dont't distroy our database. be extra careful. Implementation must be top professional level because this s an enterprice level app.

Make these more beautiful and user friendly. add effects and animation. Also make the modals more like a glassy transparent type. be extral care nopt to break any thing please.

Now. we will take a big step into making this App enterprise grade.

We will implement Microsoft login.
Our App Login Flow still maintains. we are just adding another Login Options.
users can use,
Microsoft Work email or School email, 
Personal Microsoft email.

maintain security.

Please Implement this with high level of carefulness and caution. do not break existing login flow.




What You Need to Configure
Step 1: Firebase Console
Go to Firebase Console → Your project → Authentication → Sign-in method
Enable Microsoft provider
Note the callback URL shown (you'll need it for Azure)
Step 2: Azure Portal
Go to Azure Portal → App registrations → New registration
Name: DASHMET RCA Engine
Account types: "Accounts in any organizational directory AND personal Microsoft accounts"
Register the app
Step 3: Configure Azure App
Copy the Application (client) ID
Go to Authentication → Add platform Web → Enter Firebase callback URL
Go to Certificates & secrets → Create new secret → Copy the Value immediately
Step 4: Complete Firebase Setup
Back in Firebase Console, enter:
Application (client) ID
Client secret value
Save
🔐 Security Features Implemented
Multi-tenant support: Works with personal, work, and school Microsoft accounts
Account picker: Always shows account selection (prompt: 'select_account')
Proper scopes: Requests openid, profile, email, User.Read
Comprehensive error handling: Graceful handling for popup blocks, cancellations, credential conflicts
No backend changes needed: Firebase token verification works automatically
🎯 User Experience
Users now see on the login page:

Continue with Google button
Continue with Microsoft button (new!)
Email/password option
Microsoft login supports:

Personal accounts (outlook.com, hotmail.com, live.com)
Work accounts (any Azure AD organization)
School accounts (Microsoft 365 Education)
The detailed step-by-step Azure/Firebase configuration instructions are in MICROSOFT_LOGIN_SETUP.md.

Do this with extreme professionalism, precision and care and not breaking working logic and flow. also with no mistake. this would the best colaborative App out there.