import { SkillsApiName } from '../../types';
import { ExecScriptInspector } from './ExecScript';
import { GetCurrentTimeInspector } from './GetCurrentTime';
import { ReadReferenceInspector } from './ReadReference';
import { RunCommandInspector } from './RunCommand';
import { RunSkillInspector } from './RunSkill';

export const SkillsInspectors = {
  [SkillsApiName.getCurrentTime]: GetCurrentTimeInspector,
  [SkillsApiName.execScript]: ExecScriptInspector,
  [SkillsApiName.readReference]: ReadReferenceInspector,
  [SkillsApiName.runCommand]: RunCommandInspector,
  [SkillsApiName.activateSkill]: RunSkillInspector,
  // @deprecated skill id
  runSkill: RunSkillInspector,
};
