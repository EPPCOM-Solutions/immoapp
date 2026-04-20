import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Keine E-Mail angegeben.' }, { status: 400 });
    }

    const { rows } = await query('SELECT * FROM livingmatch_users WHERE email = $1', [email]);
    if (rows.length === 0) {
      // For security, do not reveal if email exists. Still return 200.
      return NextResponse.json({ message: 'Falls ein Account mit dieser E-Mail existiert, wurde eine Nachricht gesendet.' });
    }

    // Generate new random password
    const newPassword = Math.random().toString(36).slice(-8) + '!' + Math.floor(Math.random()*10);
    const hashed = await hashPassword(newPassword);

    await query('UPDATE livingmatch_users SET password_hash = $1 WHERE id = $2', [hashed, rows[0].id]);

    // Send email logic via Ionos/SMTP specified in Environment Variables
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("SMTP config missing. Could not send email. New password was:", newPassword);
      // In development fallback, just return it so I don't get locked out
       if (process.env.NODE_ENV === 'development') {
          return NextResponse.json({ message: 'DEV MODE: Dein neues Passwort lautet: ' + newPassword });
       }
      return NextResponse.json({ error: 'Mail-Server (SMTP) nicht konfiguriert.' }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"LivingMatch System" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Dein neues LivingMatch Passwort",
      text: `Hallo,\n\ndein neues LivingMatch Passwort lautet: ${newPassword}\n\nBitte ändere dieses Passwort nach dem nächsten Login in deinen Profileinstellungen.\n\nDein LivingMatch System`,
    });

    return NextResponse.json({ message: 'Falls ein Account existiert, wurde das Passwort zugesandt.' });

  } catch (err: any) {
    console.error("Forgot Password Error:", err);
    return NextResponse.json({ error: 'Fehler beim Zurücksetzen' }, { status: 500 });
  }
}
