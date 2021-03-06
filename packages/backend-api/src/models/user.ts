/*
Copyright 2017 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import * as Joi from 'joi';
import * as Sequelize from 'sequelize';

import { sequelize } from '../sequelize';
import { IArticleInstance } from './article';
import { ICategoryInstance } from './category';
import { IBaseAttributes, IBaseInstance } from './constants';
import { updateHappened } from './last_update';

export const USER_GROUP_GENERAL = 'general';
export const USER_GROUP_ADMIN = 'admin';
export const USER_GROUP_SERVICE = 'service';
export const USER_GROUP_YOUTUBE = 'youtube';
export const USER_GROUP_MODERATOR = 'moderator';

export const USER_GROUPS = [
  USER_GROUP_GENERAL,
  USER_GROUP_ADMIN,
  USER_GROUP_SERVICE,
  USER_GROUP_YOUTUBE,
  USER_GROUP_MODERATOR,
];

// Configuration constants for moderator service users
export const ENDPOINT_TYPE_PROXY = 'perspective-proxy';
export const ENDPOINT_TYPE_API = 'perspective-api';

export interface IRequestedAttributes {
  [attribute: string]:  {
    scoreType?: string;
    scoreThreshold?: number;
  };
}

export interface IScorerExtra {
  endpointType: string;
  apiKey: string;
  endpoint: string;
  userAgent?: string;
  attributes?: IRequestedAttributes;
}

export interface IIntegrationExtra {
  token?: any;
  lastError?: {name: string, message: string};
  isActive?: boolean;
}

export interface IServiceExtra {
  jwt: any;
}

export interface IUserAttributes extends IBaseAttributes {
  group: string;
  email?: string;
  name: string;
  isActive: boolean;
  avatarURL?: string | null;
  extra?: IScorerExtra | IIntegrationExtra | IServiceExtra | null;
}

export type  IUserInstance = Sequelize.Instance<IUserAttributes> & IUserAttributes & IBaseInstance & {
  getAssignedArticles: Sequelize.BelongsToManyGetAssociationsMixin<IArticleInstance>;
  countAssignedArticles: Sequelize.BelongsToManyCountAssociationsMixin;
  getAssignedCategories: Sequelize.BelongsToManyGetAssociationsMixin<ICategoryInstance>;
  countAssignedCategories: Sequelize.BelongsToManyCountAssociationsMixin;
};

export const User = sequelize.define<IUserInstance, IUserAttributes>('user', {
  id: {
    type: Sequelize.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },

  group: {
    type: Sequelize.ENUM(USER_GROUPS),
    allowNull: false,
  },

  name: {
    type: Sequelize.CHAR(255),
    allowNull: false,
  },

  email: {
    type: Sequelize.CHAR(255),
    allowNull: true,
  },

  isActive: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },

  avatarURL: {
    type: Sequelize.CHAR(255),
    allowNull: true,
  },

  extra: {
    type: Sequelize.JSON,
    allowNull: true,
  },
}, {
  indexes: [
    {
      name: 'users_email',
      fields: ['email'],
    },
    {
      name: 'group_index',
      fields: ['group'],
    },
    {
      name: 'isActive_index',
      fields: ['isActive'],
    },
    {
      fields: ['email', 'group'],
      unique: true,
    },
  ],

  validate: {
    /**
     * Require an email address for non-service users
     */
    requireEmailForHumans() {
      const group = this.group;
      if (group === USER_GROUP_GENERAL || group === USER_GROUP_ADMIN) {
        const validEmail = Joi.validate(this.email, Joi.string().email().required(), { convert: false });
        if (validEmail.error) {
          throw new Error('Email address required for human users');
        }
      }
    },
  },

  hooks: {
    afterCreate: updateHappened,
    afterDestroy: updateHappened,
    afterUpdate: updateHappened,
    afterBulkCreate: updateHappened,
    afterBulkUpdate: updateHappened,
    afterBulkDestroy: updateHappened,
  },
});

User.associate = (models: any) => {
  User.belongsToMany(models.Category, {
    through: {
      model: models.UserCategoryAssignment,
      unique: false,
    },
    foreignKey: 'userId',
  });

  User.belongsToMany(models.Article, {
    through: {
      model: models.ModeratorAssignment,
      unique: false,
    },
    foreignKey: 'userId',
    as: 'assignedArticles',
  });

  User.belongsToMany(models.Category, {
    through: {
      model: models.UserCategoryAssignment,
      unique: false,
    },
    foreignKey: 'userId',
    as: 'assignedCategories',
  });
};

export function isUser(instance: any) {
  // TODO: instanceof doesn't work under some circumstances that I don't really understand.
  //       Hopefully fixed in later sequelize.
  //       Instead check for an attribute unique to this object.
  // return instance instanceof User.Instance;
  return instance && instance.get && !!instance.group;
}
