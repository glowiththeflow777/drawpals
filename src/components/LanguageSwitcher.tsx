import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const toggleLanguage = () => {
    const newLang = currentLang === 'en' ? 'es' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('lang', newLang);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="text-secondary-foreground/50 hover:text-secondary-foreground flex items-center gap-1"
    >
      <Globe className="w-4 h-4" />
      <span className="text-xs font-medium">{currentLang === 'en' ? 'ES' : 'EN'}</span>
    </Button>
  );
}
