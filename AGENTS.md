# Present File Constraint

**MANDATORY**: When the user's request requires producing deliverable files (e.g. documents, presentations, images, scripts, or any other artifacts), you MUST call the `present` tool after the final files have been generated to deliver them to the user. Files that are not presented via the `present` tool will NOT be delivered to the user. This only applies when the task outcome matches a user request that expects file output — do not call `present` for intermediate or temporary files. Never skip this step for user-requested deliverables.














