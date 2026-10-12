export const metadata = { title: 'Privacy – InkAge' };
export default function Privacy() {
  return (
    <div className="legal">
      <a href="/">← InkAge</a>
      <h1>Privacy Policy</h1>
      <p>Last updated: October 2026</p>
      <h2>Photos</h2>
      <p>Your photo and design are sent to our AI image provider (OpenAI) only to create your preview. We do not store your photos or results on our servers; they stay in your browser until you save or share them. Our AI provider may keep data for a limited time for abuse monitoring under its own policy.</p>
      <h2>Account data</h2>
      <p>We store your email address, your plan, and a log of when you created previews (to apply plan limits). Sign-in is handled by Supabase. Payments are handled by Stripe; we never see your card details.</p>
      <h2>Your rights</h2>
      <p>You can ask us to access or delete your data at any time by replying to any email from us. Under the GDPR you may also complain to your local data protection authority.</p>
      <h2>Cookies</h2>
      <p>We only use storage needed to keep you signed in. No advertising trackers.</p>
    </div>
  );
}
