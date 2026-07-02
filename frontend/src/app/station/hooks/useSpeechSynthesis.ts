import { useCallback, useEffect, useState } from 'react';

export const useSpeechSynthesis = () => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const updateVoices = () => {
        setVoices(window.speechSynthesis.getVoices());
      };
      
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';

        const currentVoices = window.speechSynthesis.getVoices().length > 0 
          ? window.speechSynthesis.getVoices() 
          : voices;

        const idVoice = currentVoices.find((voice) => {
          const lang = voice.lang.toLowerCase().replace('_', '-');
          const name = voice.name.toLowerCase();
          return lang === 'id-id' || lang.startsWith('id-') || name.includes('indonesia');
        });

        if (idVoice) {
          utterance.voice = idVoice;
        }

        utterance.pitch = 1.0;
        utterance.rate = 1.0;

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Gagal memicu SpeechSynthesis:', err);
      }
    }
  }, [voices]);

  return { speak };
};
