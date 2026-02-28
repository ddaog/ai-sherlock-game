import { Checkout } from "@polar-sh/nextjs";

export const GET = Checkout({
    accessToken: process.env.POLAR_ACCESS_TOKEN as string,
    successUrl: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/stories?success=true` : "http://localhost:3000/stories?success=true",
    returnUrl: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/stories` : "http://localhost:3000/stories",
    server: process.env.NODE_ENV === "production" ? "production" : "sandbox",
});
