// Welcome email for newly registered users — styled to match the
// Freddi Family Chronicle newsletter and admin digest (dark parchment,
// gold accents, Georgia serif, feature cards, gold CTA button).
export function welcomeEmailHtml({ givenNames, appUrl }) {
  const name = givenNames ? String(givenNames).split(' ')[0] : 'Friend';
  const home = appUrl || '/';

  const features = [
    { title: 'Upload Events', desc: 'Share photographs, certificates, letters, and stories. Our AI helps analyse and tag them automatically.', path: '/upload' },
    { title: 'Explore the Map', desc: 'See where your ancestors lived and migrated across the world.', path: '/map' },
    { title: 'Browse the Timeline', desc: 'Walk through family events in chronological order.', path: '/timeline' },
    { title: 'Family Tree', desc: 'Trace your bloodline and see how everyone is connected.', path: '/family-tree' },
    { title: 'Comment & Engage', desc: 'Leave comments, raise queries, and interact with family members on any event.', path: '/' },
  ];

  const featureHtml = features.map((f) => {
    const href = f.path === '/' ? home : `${home}${f.path}`;
    return `<a href="${href}" target="freddi_archive" rel="noopener noreferrer" style="display:block;background:#1A1614;border:1px solid rgba(201,145,58,0.12);border-radius:6px;padding:14px 16px;margin-bottom:8px;text-decoration:none;color:#F5ECD7;">
      <p style="color:#F5ECD7;font-size:14px;font-weight:bold;margin:0 0 4px;">${f.title} <span style="color:#C9913A;font-size:11px;font-weight:normal;">Open &rarr;</span></p>
      <p style="color:#F5ECD7;opacity:0.6;font-size:13px;line-height:1.5;margin:0;">${f.desc}</p>
    </a>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0D0B0A;font-family:Georgia,serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <p style="color:#C9913A;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">The Freddi Family Archive</p>
    <h1 style="color:#F5ECD7;font-size:26px;margin:0 0 4px;">Welcome, ${name}</h1>
    <p style="color:#F5ECD7;opacity:0.5;font-size:13px;margin:0 0 28px;letter-spacing:1px;">Present &bull; Past &bull; Future</p>

    <div style="background:#1A1614;border:1px solid rgba(201,145,58,0.2);border-radius:8px;padding:24px;margin-bottom:24px;">
      <p style="color:#F5ECD7;font-size:15px;line-height:1.7;margin:0 0 16px;">Your private family history platform is now active &mdash; a place where Present, Past, and Future come together, and where photographs, certificates, letters, and stories are analysed and woven into the living story of your family.</p>
      <a href="${home}" target="freddi_archive" rel="noopener noreferrer" style="display:inline-block;background:#C9913A;color:#0D0B0A;font-size:14px;font-weight:600;padding:12px 28px;border-radius:6px;text-decoration:none;">Open the Archive &rarr;</a>
    </div>

    <p style="color:#C9913A;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">Here's what you can do</p>
    ${featureHtml}

    <div style="background:#1A1614;border:1px solid rgba(201,145,58,0.12);border-radius:8px;padding:20px;margin:24px 0;">
      <p style="color:#E8C97A;font-size:13px;letter-spacing:1px;margin:0 0 6px;">YOUR FIRST STEP</p>
      <p style="color:#F5ECD7;font-size:15px;line-height:1.6;margin:0 0 8px;">When you open the archive, you'll be invited to &ldquo;Become Your Own Ancestor&rdquo; &mdash; create your own profile to anchor your place in the family tree.</p>
      <p style="color:#F5ECD7;opacity:0.6;font-size:13px;line-height:1.5;margin:0;">Your complete archive auto-backs up to your own cloud folder, so your family's history is always yours to keep.</p>
    </div>

    <p style="color:#F5ECD7;opacity:0.7;font-size:14px;font-style:italic;margin:24px 0 4px;">We're so glad you're here.</p>
    <p style="color:#C9913A;font-size:13px;margin:0 0 28px;">&mdash; The Freddi Family Archive</p>

    <p style="color:#F5ECD7;opacity:0.3;font-size:11px;text-align:center;border-top:1px solid rgba(201,145,58,0.1);padding-top:20px;">This is an automated welcome message from the Freddi Family Archive.</p>
  </div>
</body>
</html>`;
}

export const WELCOME_EMAIL_SUBJECT = (givenNames) =>
  `Welcome to the Freddi Family Archive, ${givenNames ? givenNames.split(' ')[0] : ''}!`;