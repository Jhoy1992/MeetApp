import * as Yup from 'yup';
import {
  isBefore,
  startOfHour,
  endOfHour,
  subDays,
  parseISO,
  startOfDay,
  endOfDay,
} from 'date-fns';
import { Op } from 'sequelize';

import Meetup from '../models/Meetup';
import User from '../models/User';
import File from '../models/File';

class MeetupController {
  async index(req, res) {
    const { page = 1 } = req.query;
    const where = { user_id: req.userId };

    if (req.query.date) {
      const searchDate = parseISO(req.query.date);

      where.date = {
        [Op.between]: [startOfDay(searchDate), endOfDay(searchDate)],
      };
    }

    const meetups = await Meetup.findAll({
      where,
      order: ['date'],
      limit: 10,
      offset: (page - 1) * 10,
      attributes: [
        'id',
        'title',
        'description',
        'location',
        'date',
        'past',
        'cancelable',
      ],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name'],
        },
        {
          model: File,
          as: 'banner',
          attributes: ['id', 'path', 'url'],
        },
      ],
    });

    return res.json(meetups);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      title: Yup.string()
        .required()
        .min(5),
      description: Yup.string()
        .required()
        .min(10),
      location: Yup.string().required(),
      date: Yup.date().required(),
      banner_id: Yup.number().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails' });
    }

    const parseDate = parseISO(req.body.date);

    if (isBefore(parseDate, new Date())) {
      return res.status(400).json({ error: 'Past dates are not permitted' });
    }

    const bannerExists = await File.findByPk(req.body.banner_id);

    if (!bannerExists) {
      return res
        .status(400)
        .json({ error: 'The banner informed does not exists.' });
    }

    const { title, description, location, date } = req.body;

    const meetupExists = await Meetup.findOne({
      where: {
        user_id: req.userId,
        title,
        description,
        location,
        date: {
          [Op.between]: [startOfHour(parseDate), endOfHour(parseDate)],
        },
      },
    });

    if (meetupExists) {
      return res.status(400).json({ error: 'Meetup already exists.' });
    }

    const { id } = await Meetup.create({
      user_id: req.userId,
      ...req.body,
    });

    return res.json({
      id,
      user_id: req.userId,
      title,
      description,
      location,
      date,
    });
  }

  async update(req, res) {
    const schema = Yup.object().shape({
      title: Yup.string().min(5),
      description: Yup.string().min(10),
      location: Yup.string(),
      date: Yup.date(),
      banner_id: Yup.number(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails' });
    }

    const meetup = await Meetup.findByPk(req.params.id);

    if (!meetup) {
      return res.status(400).json({ error: 'This meetup does not exists.' });
    }

    if (meetup.user_id !== req.userId) {
      return res.status(401).json({
        error: 'You do not have permission to cancel this meetup.',
      });
    }

    if (req.body.banner_id) {
      const bannerExists = await File.findByPk(req.body.banner_id);

      if (!bannerExists) {
        return res
          .status(400)
          .json({ error: 'The banner informed does not exists.' });
      }
    }

    const {
      id,
      title,
      description,
      location,
      banner_id,
      date,
      createdAt,
    } = await meetup.update(req.body);

    return res.json({
      id,
      title,
      description,
      location,
      banner_id,
      date,
      createdAt,
    });
  }

  async delete(req, res) {
    const meetup = await Meetup.findByPk(req.params.id);

    if (!meetup) {
      return res.status(400).json({ error: 'This meetup does not exists.' });
    }

    if (meetup.user_id !== req.userId) {
      return res.status(401).json({
        error: 'You do not have permission to cancel this meetup.',
      });
    }

    const dateWithSub = subDays(meetup.date, 2);

    if (isBefore(dateWithSub, new Date())) {
      return res
        .status(401)
        .json({ error: 'You can only cancel meetups 2 days in advance.' });
    }

    meetup.destroy();

    return res.json();
  }
}

export default new MeetupController();
