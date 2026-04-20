import { NextResponse } from 'next/server';
import { getAllActiveSearches, updateLastCheck } from '@/lib/searches';
import { aggregateProperties } from '@/lib/aggregator';
import nodemailer from 'nodemailer';

export async function GET(request: Request) {
  // Simple Security Check (Secret Token)
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  if (process.env.CRON_SECRET && token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const activeSearches = await getAllActiveSearches();
    const results = [];

    for (const search of activeSearches) {
      console.log(`Checking search for ${search.email}: ${search.name}`);
      
      const properties = await aggregateProperties(search.filter_settings);
      
      // Filter for "new" properties (we can only approximate this without a persistent ID store)
      // For now, we take properties that look fresh or just the first few
      const newProperties = properties.slice(0, 3);
      
      if (newProperties.length > 0) {
        // Send Email
        await sendAlertEmail(search.email as string, search.name, newProperties);
        await updateLastCheck(search.id);
        results.push({ searchId: search.id, email: search.email, status: 'Alert sent' });
      } else {
        results.push({ searchId: search.id, email: search.email, status: 'No new properties' });
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (err: any) {
    console.error("Cron Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function sendAlertEmail(to: string, searchName: string, properties: any[]) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP not configured for Cron Alert");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const propertyList = properties.map(p => `
    <div style="margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
      <h3 style="margin: 0 0 5px 0;">${p.title}</h3>
      <p style="margin: 0; color: #666;">${p.address} | ${p.price.toLocaleString()} € | ${p.rooms} Zi. | ${p.livingSpace} m²</p>
      <a href="${p.url}" style="display: inline-block; margin-top: 10px; background: #f97316; color: white; padding: 8px 15px; border-radius: 5px; text-decoration: none; font-weight: bold;">Anzeige öffnen</a>
    </div>
  `).join('');

  await transporter.sendMail({
    from: `"LivingMatch Alerts" <${process.env.SMTP_USER}>`,
    to,
    subject: `LivingMatch: Neue Treffer für "${searchName}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #f97316;">Neue Treffer gefunden!</h1>
        <p>Hallo,</p>
        <p>wir haben neue Immobilien für deine Suche <strong>"${searchName}"</strong> gefunden:</p>
        <div style="margin-top: 30px;">
          ${propertyList}
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #999;">Diese E-Mail wurde automatisch von deinem LivingMatch System erstellt.</p>
      </div>
    `,
  });
}
