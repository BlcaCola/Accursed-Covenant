import {afterEach,describe,expect,it} from 'vitest';
import {setLocale,t} from '../src/i18n';

describe('bilingual interface text',()=>{
  afterEach(()=>setLocale('en'));
  it('uses English by default and translates static and dynamic combat text',()=>{
    expect(t('封门围攻 · 房门封闭')).toBe('Sealed Siege · DOORS SEALED');
    setLocale('zh');expect(t('封门围攻 · 房门封闭')).toBe('封门围攻 · 房门封闭');
    setLocale('en');expect(t('封门围攻 · 房门封闭')).toBe('Sealed Siege · DOORS SEALED');
    expect(t('关键房间 2 / 4 · 剩余敌人 3')).toBe('Key chambers 2 / 4 · Enemies remaining 3');
  });
});
