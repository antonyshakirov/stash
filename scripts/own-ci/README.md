# Owned checks

Run `./scripts/check-release` from the Git root with Node.js 22 on PATH; then run `./scripts/check-release --verify` before merge or release. Python steps require Python 3.12. Native prerequisites, if any, are explicit in the plan.

The plan runs every required command in a fresh detached copy of the exact clean commit. No ignored environment files, account configuration or installed dependencies are copied. Public dependencies come from lockfiles; tests use temporary data. Node tests block outbound network at the program API boundary; this is not an OS firewall. Dependency installation and font downloads during builds are separate permitted network steps.

A private state directory outside the repository retains the exact source/tree/plan identity, logs and required artifacts. Verification requires their hashes, successful mandatory commands, cleanup and a result less than six hours old. A failed or unfinished latest run invalidates earlier success. Do not edit proof files or use GitHub statuses as a substitute.

The checks certify the tested behavior and build; live provider transactions, account data, signed store submissions and production writes are outside this local gate. CI-only changes do not require redeploying an identical application.
