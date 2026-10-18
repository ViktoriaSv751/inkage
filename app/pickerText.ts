// The language picker's own words in every language, so it switches the moment a language is tapped
// (before saving, and even for languages whose full dictionary isn't loaded).
import type { Lang } from '@/lib/tr';

type P = { settings: string; title: string; sub: string; current: string; note: string; save: string; cancel: string; back: string; language: string };
export const PICKER: Record<Lang, P> = {
  hu: { settings: 'Beállítások', title: 'Válassz nyelvet', sub: 'A teljes oldal és az app is átvált. Bármikor módosíthatod.', current: 'Jelenlegi', note: 'A választásodat ezen az eszközön megjegyezzük.', save: 'Mentés', cancel: 'Mégse', back: 'Vissza', language: 'Nyelv' },
  en: { settings: 'Settings', title: 'Choose your language', sub: 'The whole site and the app will switch. You can change it any time.', current: 'Current', note: 'Your choice is remembered on this device.', save: 'Save', cancel: 'Cancel', back: 'Back', language: 'Language' },
  de: { settings: 'Einstellungen', title: 'Wähle deine Sprache', sub: 'Die ganze Website und die App wechseln mit. Du kannst es jederzeit ändern.', current: 'Aktuell', note: 'Deine Wahl wird auf diesem Gerät gespeichert.', save: 'Speichern', cancel: 'Abbrechen', back: 'Zurück', language: 'Sprache' },
  es: { settings: 'Ajustes', title: 'Elige tu idioma', sub: 'Toda la web y la app cambiarán. Puedes cambiarlo cuando quieras.', current: 'Actual', note: 'Tu elección se guarda en este dispositivo.', save: 'Guardar', cancel: 'Cancelar', back: 'Atrás', language: 'Idioma' },
  pt: { settings: 'Configurações', title: 'Escolha seu idioma', sub: 'O site inteiro e o app vão mudar. Você pode trocar quando quiser.', current: 'Atual', note: 'Sua escolha fica salva neste aparelho.', save: 'Salvar', cancel: 'Cancelar', back: 'Voltar', language: 'Idioma' },
  fr: { settings: 'Réglages', title: 'Choisis ta langue', sub: 'Tout le site et l’app vont changer. Tu peux la modifier à tout moment.', current: 'Actuelle', note: 'Ton choix est mémorisé sur cet appareil.', save: 'Enregistrer', cancel: 'Annuler', back: 'Retour', language: 'Langue' },
  it: { settings: 'Impostazioni', title: 'Scegli la lingua', sub: 'Cambieranno tutto il sito e l’app. Puoi modificarla quando vuoi.', current: 'Attuale', note: 'La tua scelta viene ricordata su questo dispositivo.', save: 'Salva', cancel: 'Annulla', back: 'Indietro', language: 'Lingua' },
  pl: { settings: 'Ustawienia', title: 'Wybierz język', sub: 'Zmieni się cała strona i aplikacja. Możesz to zmienić w każdej chwili.', current: 'Obecny', note: 'Twój wybór zostanie zapamiętany na tym urządzeniu.', save: 'Zapisz', cancel: 'Anuluj', back: 'Wstecz', language: 'Język' },
  tr: { settings: 'Ayarlar', title: 'Dilini seç', sub: 'Tüm site ve uygulama değişir. İstediğin zaman değiştirebilirsin.', current: 'Mevcut', note: 'Seçimin bu cihazda hatırlanır.', save: 'Kaydet', cancel: 'Vazgeç', back: 'Geri', language: 'Dil' },
  ro: { settings: 'Setări', title: 'Alege limba', sub: 'Tot site-ul și aplicația se schimbă. O poți modifica oricând.', current: 'Actuală', note: 'Alegerea ta este reținută pe acest dispozitiv.', save: 'Salvează', cancel: 'Anulează', back: 'Înapoi', language: 'Limbă' },
  nl: { settings: 'Instellingen', title: 'Kies je taal', sub: 'De hele site en de app schakelen mee. Je kunt het altijd wijzigen.', current: 'Huidig', note: 'Je keuze wordt op dit apparaat onthouden.', save: 'Opslaan', cancel: 'Annuleren', back: 'Terug', language: 'Taal' },
  sv: { settings: 'Inställningar', title: 'Välj språk', sub: 'Hela sajten och appen byter språk. Du kan ändra när du vill.', current: 'Nuvarande', note: 'Ditt val sparas på den här enheten.', save: 'Spara', cancel: 'Avbryt', back: 'Tillbaka', language: 'Språk' },
  cs: { settings: 'Nastavení', title: 'Vyber si jazyk', sub: 'Přepne se celý web i aplikace. Můžeš to kdykoli změnit.', current: 'Aktuální', note: 'Tvoje volba se uloží na tomto zařízení.', save: 'Uložit', cancel: 'Zrušit', back: 'Zpět', language: 'Jazyk' },
  el: { settings: 'Ρυθμίσεις', title: 'Διάλεξε γλώσσα', sub: 'Θα αλλάξει όλος ο ιστότοπος και η εφαρμογή. Μπορείς να την αλλάξεις όποτε θέλεις.', current: 'Τρέχουσα', note: 'Η επιλογή σου αποθηκεύεται σε αυτή τη συσκευή.', save: 'Αποθήκευση', cancel: 'Άκυρο', back: 'Πίσω', language: 'Γλώσσα' },
  uk: { settings: 'Налаштування', title: 'Обери мову', sub: 'Зміниться весь сайт і застосунок. Можеш змінити будь-коли.', current: 'Поточна', note: 'Твій вибір збережеться на цьому пристрої.', save: 'Зберегти', cancel: 'Скасувати', back: 'Назад', language: 'Мова' },
  ja: { settings: '設定', title: '言語を選択', sub: 'サイトとアプリ全体が切り替わります。いつでも変更できます。', current: '現在', note: '選択はこの端末に保存されます。', save: '保存', cancel: 'キャンセル', back: '戻る', language: '言語' },
  ko: { settings: '설정', title: '언어를 선택하세요', sub: '사이트와 앱 전체가 바뀌어요. 언제든지 변경할 수 있어요.', current: '현재', note: '선택한 언어는 이 기기에 저장돼요.', save: '저장', cancel: '취소', back: '뒤로', language: '언어' },
  id: { settings: 'Pengaturan', title: 'Pilih bahasamu', sub: 'Seluruh situs dan aplikasi akan berganti. Kamu bisa mengubahnya kapan saja.', current: 'Saat ini', note: 'Pilihanmu disimpan di perangkat ini.', save: 'Simpan', cancel: 'Batal', back: 'Kembali', language: 'Bahasa' },
  th: { settings: 'การตั้งค่า', title: 'เลือกภาษา', sub: 'ทั้งเว็บไซต์และแอปจะเปลี่ยนภาษา เปลี่ยนได้ทุกเมื่อ', current: 'ปัจจุบัน', note: 'ระบบจะจำตัวเลือกของคุณไว้ในอุปกรณ์นี้', save: 'บันทึก', cancel: 'ยกเลิก', back: 'กลับ', language: 'ภาษา' },
  zh: { settings: '設定', title: '選擇語言', sub: '整個網站和 App 都會切換，隨時可以更改。', current: '目前', note: '你的選擇會記在這台裝置上。', save: '儲存', cancel: '取消', back: '返回', language: '語言' },
};

/** A language's name written in another language (from the browser), falling back to the English name. */
export function langName(code: string, inLang: string, locale: string, fallback: string) {
  try {
    const dn = new (Intl as any).DisplayNames([locale], { type: 'language' });
    const v = dn.of(code === 'zh' ? 'zh-Hant' : code === 'pt' ? 'pt-BR' : code);
    if (v && v !== code) return v.charAt(0).toLocaleUpperCase(locale) + v.slice(1);
  } catch {}
  void inLang;
  return fallback;
}
