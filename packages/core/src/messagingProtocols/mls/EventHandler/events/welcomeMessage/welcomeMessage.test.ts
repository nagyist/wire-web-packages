/*
 * Wire
 * Copyright (C) 2022 Wire Swiss GmbH
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see http://www.gnu.org/licenses/.
 *
 */

import {BackendEvent, ConversationMLSWelcomeEvent, CONVERSATION_EVENT} from '@wireapp/api-client/lib/event';

import {handleWelcomeMessage, isWelcomeMessageEvent} from './welcomeMessage';

import {MLSService} from '../../..';
import {NotificationSource} from '../../../../../notification';

jest.mock('bazinga64', () => ({
  ...jest.requireActual('bazinga64'),
  Decoder: {
    fromBase64: jest.fn().mockImplementation((value: string) => ({
      asBytes: jest.fn().mockReturnValue(value),
    })),
  },
  Encoder: {
    toBase64: jest.fn().mockImplementation((value: string) => ({
      asString: value,
    })),
  },
}));

const mockParams = {
  event: {
    type: CONVERSATION_EVENT.MLS_WELCOME_MESSAGE,
  } as ConversationMLSWelcomeEvent,
  source: {} as NotificationSource,
  mlsService: {
    processWelcomeMessage: jest.fn().mockResolvedValue('conversationId'),
    scheduleKeyMaterialRenewal: jest.fn(),
  } as unknown as MLSService,
  dryRun: false,
};

describe('MLS welcomeMessage eventHandler', () => {
  describe('isWelcomeMessageEvent', () => {
    it('returns true for a welcome message event', () => {
      const event = {
        type: CONVERSATION_EVENT.MLS_WELCOME_MESSAGE,
      } as BackendEvent;
      expect(isWelcomeMessageEvent(event)).toBe(true);
    });

    it('returns false for a non-welcome message event', () => {
      const event = {
        type: CONVERSATION_EVENT.MEMBER_JOIN,
      } as BackendEvent;
      expect(isWelcomeMessageEvent(event)).toBe(false);
    });
  });

  describe('handleWelcomeMessage', () => {
    it('calls processWelcomeMessage and schedules periodic key material updates', async () => {
      await handleWelcomeMessage(mockParams);
      expect(mockParams.mlsService.processWelcomeMessage).toHaveBeenCalled();
      expect(mockParams.mlsService.scheduleKeyMaterialRenewal).toHaveBeenCalled();
    });

    it('returns a eventHandlerResult', async () => {
      const eventHandlerResult = await handleWelcomeMessage(mockParams);
      expect(eventHandlerResult).toBeDefined();
      expect(eventHandlerResult!.event).toEqual({data: 'conversationId', type: 'conversation.mls-welcome'});
    });
  });
});
