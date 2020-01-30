import { startOfHour, endOfHour } from 'date-fns';
import { Op } from 'sequelize';
import User from '../models/User';
import Meetup from '../models/Meetup';
import Subscription from '../models/Subscriptions';
import Queue from '../../lib/Queue';
import SubscriptionMail from '../jobs/SubscriptionMail';

class SubscriptionsController {
  async index(req, res) {
    const subscriptions = await Subscription.findAll({
      where: {
        user_id: req.userId,
      },
      include: [
        {
          model: Meetup,
          where: {
            date: { [Op.gt]: new Date() },
          },
          required: true,
          attributes: ['title', 'description', 'location', 'date'],
        },
      ],
      order: [[Meetup, 'date']],
      attributes: [],
    });

    return res.json(subscriptions);
  }

  async store(req, res) {
    const { meetupId } = req.params;
    const user = await User.findByPk(req.userId);

    const meetup = await Meetup.findByPk(meetupId, {
      include: [{ model: User, as: 'user' }],
    });

    if (!meetup) {
      return res.status(400).json({ error: 'Meetup does not exists.' });
    }

    if (meetup.past) {
      return res.status(400).json({ error: 'Meetup already passed.' });
    }

    if (meetup.user_id === req.userId) {
      return res
        .status(400)
        .json({ error: "Can't subscribe to you own meetups" });
    }

    const checkSubscriptions = await Subscription.findOne({
      where: {
        user_id: req.userId,
        meetup_id: meetupId,
      },
    });

    if (checkSubscriptions) {
      return res
        .status(400)
        .json({ error: 'You are already subscribed to  this meetup.' });
    }

    const checkHour = await Subscription.findOne({
      where: {
        user_id: req.userId,
      },
      include: [
        {
          model: Meetup,
          required: true,
          where: {
            date: {
              [Op.between]: [startOfHour(meetup.date), endOfHour(meetup.date)],
            },
          },
        },
      ],
    });

    if (checkHour) {
      return res
        .status(400)
        .json({ error: "Can't subscribe to two meetups at the same hour" });
    }

    const subscription = await Subscription.create({
      user_id: req.userId,
      meetup_id: meetupId,
    });

    await Queue.add(SubscriptionMail.key, {
      meetup,
      user,
    });

    return res.json({ subscription });
  }
}

export default new SubscriptionsController();
