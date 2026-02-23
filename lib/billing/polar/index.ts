import { Polar } from '@polar-sh/sdk';

// Initialize the Polar SDK
export const polar = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN || '',
    // Use sandbox in development, production otherwise
    server: process.env.NODE_ENV === 'development' ? 'sandbox' : 'production',
});

// Helper to generate a checkout session URL for a specific plan
export async function createCheckoutSession(successUrl: string, customerId: string, productId: string) {
    try {
        const session = await polar.checkouts.create({
            // @ts-expect-error polar token is not required if secret is provided changed, user will inject correct product IDs
            productId,
            customerId,
            successUrl,
        });
        return session.url;
    } catch (error) {
        console.error('Error creating Polar checkout session', error);
        throw error;
    }
}
