import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { env } from "../src/config/env.js";
import { closeDatabase } from "../src/db/client.js";
import { AppError } from "../src/lib/errors.js";
import { createAdminAccount, MIN_PASSWORD_LENGTH, } from "../src/services/admin.service.js";
const readLine = async (question) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        return (await rl.question(question)).trim();
    }
    finally {
        rl.close();
    }
};
/** Masked password input on a TTY; falls back to a plain read when piped. */
const readPassword = (question) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        return readLine(question);
    }
    return new Promise((resolve, reject) => {
        const stdin = process.stdin;
        const stdout = process.stdout;
        let value = "";
        const cleanup = () => {
            stdin.setRawMode(false);
            stdin.pause();
            stdin.off("data", onData);
            stdout.write("\n");
        };
        const onData = (chunk) => {
            for (const char of chunk) {
                if (char === "\r" || char === "\n") {
                    cleanup();
                    resolve(value);
                    return;
                }
                if (char === "\u0003" || char === "\u0004") {
                    cleanup();
                    reject(new Error("Cancelled."));
                    return;
                }
                if (char === "\u007f" || char === "\b") {
                    if (value.length > 0) {
                        value = value.slice(0, -1);
                        stdout.write("\b \b");
                    }
                    continue;
                }
                if (char < " ")
                    continue;
                value += char;
                stdout.write("*");
            }
        };
        stdout.write(question);
        stdin.setEncoding("utf8");
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on("data", onData);
    });
};
const fail = (message) => {
    console.error(`Cannot create admin: ${message}`);
    process.exitCode = 1;
    throw new Error(message);
};
const main = async () => {
    const emailInput = env.adminEmail ?? (await readLine("Admin email: "));
    if (!emailInput)
        fail("an email address is required.");
    let password;
    if (env.adminPassword) {
        password = env.adminPassword;
    }
    else {
        password = await readPassword(`Admin password (min ${MIN_PASSWORD_LENGTH} chars): `);
        const confirmation = await readPassword("Confirm password: ");
        if (password !== confirmation) {
            fail("the passwords do not match.");
        }
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        fail(`the password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    try {
        const admin = await createAdminAccount({ email: emailInput, password });
        console.log(`Created the admin account for ${admin.email}.`);
        console.log("Sign in at POST /api/auth/login with these credentials.");
    }
    catch (error) {
        if (error instanceof AppError) {
            fail(error.message);
        }
        throw error;
    }
};
main()
    .then(async () => {
    await closeDatabase();
})
    .catch(async (error) => {
    if (!(error instanceof AppError) && process.exitCode !== 1) {
        console.error(`admin:create failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
    }
    await closeDatabase().catch(() => undefined);
});
//# sourceMappingURL=admin-create.js.map