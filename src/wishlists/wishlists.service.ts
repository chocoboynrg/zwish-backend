import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wishlist } from './wishlist.entity';
import { Event } from '../events/event.entity';

@Injectable()
export class WishlistsService {
  constructor(
    @InjectRepository(Wishlist)
    private readonly wishlistsRepository: Repository<Wishlist>,

    @InjectRepository(Event)
    private readonly eventsRepository: Repository<Event>,
  ) {}

  getAllWishlists() {
    return this.wishlistsRepository.find();
  }

  async createWishlist(title: string, eventId: number, description?: string) {
    const event = await this.eventsRepository.findOneBy({ id: eventId });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const wishlist = this.wishlistsRepository.create({
      title,
      description,
      event,
    });

    return this.wishlistsRepository.save(wishlist);
  }
}
