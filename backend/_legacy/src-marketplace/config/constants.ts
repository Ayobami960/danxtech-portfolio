import { ApiError } from "../utils/api-error.js";

export const API_PREFIX = "/api/v1";
export const SERVICE_NAME = "@portfolio-services"

export const ACCOUNT_AUTH_CACHE_TTL_SECONDS = 10 * 60

export const requireText = (value: string | undefined | string[], fieldName: string): string => {
    if(typeof value !== "string" || !value.trim()){
        throw new ApiError(400, `${fieldName} is required.`)
    }

    return value.trim();
};

export const requireWebsite = (value: string | undefined): string => {
    const website = requireText(value, "Company website");

    try {
        const url = new URL(website);
        if(url.protocol !== "https:"){
            throw new Error("Unsupported protocol.")
        }
    } catch (error) {
       throw new ApiError(400, "Company website must be a valid HTTPS URL.") 
    }

    return website;
}








