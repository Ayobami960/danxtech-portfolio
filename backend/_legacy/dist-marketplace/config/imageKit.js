import ImageKit from "@imagekit/nodejs";
import { env } from "./env.js";
export const imageKit = new ImageKit({
    privateKey: env.imageKitPrivateKey ?? "",
});
//# sourceMappingURL=imageKit.js.map