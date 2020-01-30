import { format, parseISO } from 'date-fns';
import pt from 'date-fns/locale/pt';
import Mail from '../../lib/Mail';

class CancellationMail {
  get key() {
    return 'SubscriptionMail';
  }

  async handle({ data }) {
    const { meetup, user } = data;

    await Mail.sendMail({
      to: `${meetup.user.name} <${meetup.user.email}>`,
      subject: 'Nova inscrição na Meetup',
      template: 'subscription',
      context: {
        organizer: meetup.user.name,
        meetup_id: meetup.id,
        meetup_name: meetup.title,
        user: user.name,
        email: user.email,
        date: format(
          parseISO(meetup.date),
          "'dia' dd 'de' MMMM', às ' H:mm'h'",
          {
            locale: pt,
          }
        ),
      },
    });
  }
}

export default new CancellationMail();
