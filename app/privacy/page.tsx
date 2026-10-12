export const metadata = { title: 'Privacy – InkAge' };
export default function Privacy() {
  return (
    <div className="legal">
      <a href="/">← InkAge</a>
      <h1>Privacy Policy</h1>
      <p>Last updated: October 2026</p>
      <h2>Photos and designs</h2>
      <p>Your photo and design are sent to our AI providers (Google Gemini, and OpenAI as a backup) only to check the photo and create your preview. The providers may keep data for a limited time for abuse monitoring under their own policies; they do not use it to identify you.</p>
      <p>If you are not signed in, your previews are saved only in your browser on this device. If you are signed in, your previews are stored in your private account storage (hosted by Supabase) so you can see them on every device. Only you can access them.</p>
      <h2>Sharing</h2>
      <p>When you tap “Ask friends”, we copy the fresh and 50-year images to a public link. Anyone with the link can see those two images and vote. Deleting the preview hides the link.</p>
      <h2>Account and usage data</h2>
      <p>We store your email address, your plan, your onboarding answers (e.g. preferred style and placement), referral bonuses and a log of when you created previews, to apply limits and improve the app. For guests we store a random device ID and a one-way hash of the IP address to prevent abuse. We record simple, anonymous in-app events (for example “preview created”) in our own database — no advertising trackers, no third-party analytics.</p>
      <h2>Your rights</h2>
      <p>You can delete your account and every saved preview yourself at any time in the app (Profile → Delete my account and data). You can also ask us to access or delete your data by replying to any email from us. Under the GDPR you may complain to your local data protection authority.</p>
      <h2>Storage on your device</h2>
      <p>We use local storage only to keep you signed in, remember your language and onboarding answers, and keep guest previews on your device.</p>
    </div>
  );
}
