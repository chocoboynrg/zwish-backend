import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const typeOrmTestConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'Icecreamgirl1443',
  database: 'wishlist_test_db', // ⚠️ IMPORTANT
  autoLoadEntities: true,
  synchronize: true,
  dropSchema: true, // 🔥 reset auto
};
