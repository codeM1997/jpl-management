# Agent Workflow & Steering Guidelines

Whenever the user requests a feature, enhancement, or bug fix, you MUST follow this strict step-by-step workflow. Do NOT skip steps or combine them.

### Step 1: Acknowledge & Propose
Do NOT write code, modify files, or execute commands immediately. 
Analyze the request, explain how you plan to implement it, and present the user with options and trade-offs. 

### Step 2: Wait for Approval
Stop and wait. The user will choose an option, ask questions, and eventually approve the plan. Do not proceed until you have explicit approval.

### Step 3: Implement
Once approved, write the code and make the necessary file modifications. 
Do NOT commit or push the code yet.

### Step 4: Wait for User Testing
Notify the user that the code has been written and ask them to test it on their end. Stop and wait for their confirmation.

### Step 5: Verification Build
Before pushing, run `npm run build` locally to guarantee there are no TypeScript or compilation errors.

### Step 6: Commit & Push
Only after the user explicitly confirms the code works, gives permission to commit, and the build passes, you may run `git commit` and `git push`.
