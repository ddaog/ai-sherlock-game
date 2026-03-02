import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { routing } from '@/lib/i18n/routing';
import { notFound } from 'next/navigation';
import { Nanum_Myeongjo, JetBrains_Mono } from 'next/font/google';
import "../globals.css";

const nanumMyeongjo = Nanum_Myeongjo({
    subsets: ['latin'],
    weight: ['400', '700'],
    variable: '--font-nanum-serif'
});

const jetBrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    weight: ['400', '700'],
    variable: '--font-jetbrains-mono'
});

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
    children,
    params
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!routing.locales.includes(locale as any)) {
        notFound();
    }

    const messages = await getMessages();

    return (
        <html lang={locale} className={`${nanumMyeongjo.variable} ${jetBrainsMono.variable}`}>
            <head>
                <meta name="google-adsense-account" content="ca-pub-5891083791167051" />
                <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5891083791167051" crossOrigin="anonymous"></script>
            </head>
            <body className="bg-archive-bg text-archive-text h-dvh w-full overflow-hidden font-serif antialiased scanlines">
                <NextIntlClientProvider messages={messages}>
                    {children}
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
