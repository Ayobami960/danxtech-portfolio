import { z } from "zod";
/**
 * Bundled blocklist of the most frequently leaked passwords. Short by design:
 * the point is to stop the obvious choices without shipping a wordlist.
 */
const COMMON_PASSWORDS = new Set(`password password1 password12 password123 password1234 password12345
  password123456 password1234567 password12345678 password!
  passw0rd p@ssw0rd p@ssword pass1234 pass12345
  123456 1234567 12345678 123456789 1234567890 12345678910 123456789a
  0123456789 987654321 111111 11111111 1111111111 000000 00000000
  222222 333333 444444 555555 666666 777777 888888 999999 121212 123123
  123321 112233 123abc 1q2w3e4r 1q2w3e4r5t 1qaz2wsx qwerty qwerty1
  qwerty12 qwerty123 qwerty1234 qwertyuiop qwertyuiop123 asdfgh asdfghjkl
  asdf1234 zxcvbnm zxcvbnm123 zxcvbnm1234 abc123 abc12345 abc123456
  iloveyou iloveyou1 admin admin123 admin1234 administrator root root123
  superman batman football baseball basketball soccer hockey tennis
  letmein letmein123 welcome welcome1 welcome123 welcome2024 welcome2025
  monkey dragon master shadow sunshine princess michael jennifer jordan
  hunter2 trustno1 whatever freedom qazwsx qazwsxedc 1qazxsw2 zaq12wsx
  login logout secret secret123 mypassword mypassword1 changeme changeme123
  default guest temp temporary testing test1234 test12345 testtest
  computer internet samsung google facebook linkedin twitter instagram
  starwars pokemon minecraft naruto matrix killer ninja hello hello123
  hello1234 loveme lovely baby babygirl angel angels charlie donald
  flower friend friends fuckyou fuckyou1 asshole biteme mustang access
  passpass qwertyqwerty passwordpassword passwordpassword
  summer winter spring autumn january february december
  2020 2021 2022 2023 2024 2025 2026 20202020 20212021 20222022 20232023
  access14 austin bailey banana bandit barney beach bear beavis benjamin
  bigdog blowme booboo booger brandy bronco bulldog bulldogs bunny
  calvin camaro captain chester chicken claire college corvette cowboy
  crystal dakota dallas daniel david diana diesel dolphin eagles
  edward einstein elephant eminem ferrari fishing florida forever
  frank freddy gaming garden gateway gators gemini george giants
  ginger golden golfer guitar hammer happy harley heaven helpme
  hooters hotdog iceman jackie jaguar jasmine jessica johnny joshua
  junebug justin kelly knight lakers lauren leather liverpool london
  lorenzo luis maggie magnum marlboro maverick maxwell melissa mercedes
  mickey midnight miller mistress monica montana mouse nascar nathan
  newyork oliver orange packers panthers patrick peanut pepper phoenix
  please poohbear popeye porsche prince purple rabbit rainbow ranger
  raiders redsox richard robert rocket runner russia sammy sandy
  saturn school scooter scorpio secret service sexy silver skippy
  slayer smiley snoopy snowball spanky sparky spiderman spongebob
  stella steelers stephen steven success sweetie sydney taylor
  teddy thomas thunder tiger tigger tomcat topgun toyota travis
  trophy tucker turtle valentine viking violet warrior william
  winner wizard wolves yankees yellow zxcvbn zzzzzz`.split(/\s+/));
export const passwordPolicy = (password, email) => {
    if (password.length < 12) {
        return { ok: false, message: "Password must be at least 12 characters." };
    }
    if (password.length > 200) {
        return { ok: false, message: "Password must be at most 200 characters." };
    }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
        return {
            ok: false,
            message: "That password is too common. Choose something less guessable.",
        };
    }
    const localPart = email.split("@")[0]?.trim().toLowerCase();
    if (localPart && localPart.length >= 3) {
        if (password.toLowerCase().includes(localPart)) {
            return {
                ok: false,
                message: "Password must not contain your email address.",
            };
        }
    }
    return { ok: true };
};
/** Zod refinement used by both account creation and password change. */
export const strongPassword = (email) => z
    .string()
    .min(12, "Password must be at least 12 characters.")
    .max(200)
    .superRefine((value, ctx) => {
    const result = passwordPolicy(value, email);
    if (!result.ok) {
        ctx.addIssue({ code: "custom", message: result.message });
    }
});
//# sourceMappingURL=password-policy.js.map