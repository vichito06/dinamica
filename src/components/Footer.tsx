'use client';

import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Mail, Phone, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import LegalModal from './LegalModal'; // Adjust path if needed

export default function Footer() {
    const pathname = usePathname();
    const [settings, setSettings] = useState<any>(null);
    const [isTermsOpen, setIsTermsOpen] = useState(false);
    const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

    // Don't show footer on admin pages
    if (pathname?.startsWith('/admin')) {
        return null;
    }

    useEffect(() => {
        // Fetch public settings
        fetch('/api/settings/public')
            .then(res => res.json())
            .then(data => setSettings(data))
            .catch(err => console.error('Error loading footer settings', err));
    }, []);

    const year = new Date().getFullYear();

    return (
        <>
            <footer className="relative z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 py-4 mt-auto">
                <div className="container-custom">
                    {/* Row 1: Logo/Title & Email */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4 md:mb-2">
                        <div className="flex items-center gap-3">
                            <Image src="/logo.png" alt="Logo" width={32} height={32} />
                            <h3 className="text-lg font-bold text-white">Y Voss Oeee — Dinámica 1</h3>
                        </div>

                        {/* Social Media */}
                        <div className="flex flex-col items-center gap-1">
                            <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Síguenos</span>
                            <div className="flex gap-4">
                                <a
                                    href="https://www.facebook.com/YVosOee"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-white/60 hover:text-[#1877F2] hover:scale-110 transition-all"
                                    aria-label="Facebook"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                                </a>
                                <a
                                    href="https://www.instagram.com/yvossoeee/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-white/60 hover:text-[#E4405F] hover:scale-110 transition-all"
                                    aria-label="Instagram"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
                                </a>
                                <a
                                    href="https://www.tiktok.com/@yvossoeee"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-white/60 hover:text-white hover:scale-110 transition-all"
                                    aria-label="TikTok"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg>
                                </a>
                            </div>
                        </div>

                        <a
                            href={`mailto:${settings?.contactEmail || 'yvossoeee2012@gmail.com'}`}
                            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <Mail className="w-4 h-4" />
                            <span className="text-sm">{settings?.contactEmail || 'yvossoeee2012@gmail.com'}</span>
                        </a>
                    </div>

                    {/* Row 2: Links & Copyright */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-gray-500 border-t border-white/5 pt-2">
                        <div className="flex gap-4">
                            <button onClick={() => setIsTermsOpen(true)} className="hover:text-gray-300 transition-colors">Términos y Condiciones</button>
                            <button onClick={() => setIsPrivacyOpen(true)} className="hover:text-gray-300 transition-colors">Política de Privacidad</button>
                        </div>
                        <p>
                            © {year} Y Voss Oeee. Todos los derechos reservados.
                        </p>
                    </div>
                </div>
            </footer>

            {/* Legal Modals */}
            <LegalModal
                isOpen={isTermsOpen}
                onClose={() => setIsTermsOpen(false)}
                title="Términos y Condiciones"
                content={settings?.termsHtml || '<p>Cargando...</p>'}
            />
            <LegalModal
                isOpen={isPrivacyOpen}
                onClose={() => setIsPrivacyOpen(false)}
                title="Política de Privacidad"
                content={settings?.privacyHtml || '<p>Cargando...</p>'}
            />
        </>
    );
}
