'use client';

import { Block, Center } from '@lobehub/ui';
import React, { memo } from 'react';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { AsyncTaskStatus } from '@/types/asyncTask';

import { ActionButtons } from './ActionButtons';
import { ElapsedTime } from './ElapsedTime';
import { styles } from './styles';
import { type LoadingStateProps } from './types';

// Loading state component
export const LoadingState = memo<LoadingStateProps>(({ generation, aspectRatio, onDelete }) => {
  const isGenerating =
    generation.task.status === AsyncTaskStatus.Processing ||
    generation.task.status === AsyncTaskStatus.Pending;

  return (
    <Block
      align={'center'}
      className={`${styles.placeholderContainer} ${styles.placeholderContainerLoading}`}
      justify={'center'}
      variant={'filled'}
      style={{
        aspectRatio,
      }}
    >
      <Center gap={8} style={{ zIndex: 2 }}>
        <NeuralNetworkLoading size={48} />
        <ElapsedTime generationId={generation.id} isActive={isGenerating} />
      </Center>
      <ActionButtons onDelete={onDelete} />
    </Block>
  );
});

LoadingState.displayName = 'LoadingState';
