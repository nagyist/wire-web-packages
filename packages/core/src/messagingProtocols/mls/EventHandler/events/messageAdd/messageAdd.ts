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

import {BackendEvent, ConversationMLSMessageAddEvent, CONVERSATION_EVENT} from '@wireapp/api-client/lib/event';
import {Decoder} from 'bazinga64';

import {GenericMessage} from '@wireapp/protocol-messaging';

import {EventHandlerResult} from '../../../../common.types';
import {optionalToUint8Array} from '../../../MLSService/MLSService';
import {EventHandlerParams} from '../../EventHandler.types';

const isMLSMessageAddEvent = (event: BackendEvent): event is ConversationMLSMessageAddEvent =>
  event.type === CONVERSATION_EVENT.MLS_MESSAGE_ADD;

interface HandleMLSMessageAddParams extends EventHandlerParams {
  event: ConversationMLSMessageAddEvent;
}
const handleMLSMessageAdd = async (
  {mlsService, event}: HandleMLSMessageAddParams,
  onEpochChanged: (groupId: string) => Promise<void>,
): EventHandlerResult => {
  const encryptedData = Decoder.fromBase64(event.data).asBytes;

  const qualifiedConversationId = event.qualified_conversation ?? {id: event.conversation, domain: ''};

  const groupId = await mlsService.getGroupIdFromConversationId(qualifiedConversationId, event.subconv);

  // We should not receive a message for a group the client is not aware of
  if (!groupId) {
    throw new Error(
      `Could not find a group_id for conversation ${qualifiedConversationId.id}@${qualifiedConversationId.domain}`,
    );
  }

  const groupIdBytes = Decoder.fromBase64(groupId).asBytes;

  const {
    proposals,
    commitDelay,
    message,
    senderClientId: encodedSenderClientId,
    hasEpochChanged,
  } = await mlsService.decryptMessage(groupIdBytes, encryptedData);

  if (encodedSenderClientId) {
    const decoder = new TextDecoder();
    const senderClientId = decoder.decode(optionalToUint8Array(encodedSenderClientId));
    event.senderClientId = senderClientId;
  }

  // Check if the message includes proposals
  if (typeof commitDelay === 'number' || proposals.length > 0) {
    // we are dealing with a proposal, add a task to process this proposal later on
    // Those proposals are stored inside of coreCrypto and will be handled after a timeout
    await mlsService.handlePendingProposals({
      groupId,
      delayInMs: commitDelay ?? 0,
      eventTime: event.time,
    });
  }

  if (hasEpochChanged) {
    await onEpochChanged(groupId);
  }

  return message ? {event, decryptedData: GenericMessage.decode(message)} : undefined;
};

export {isMLSMessageAddEvent, handleMLSMessageAdd};
