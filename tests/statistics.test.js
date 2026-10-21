import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyActivity, filterLinks, groupVisits } from '../src/statistics.js';

test('daily totals use local calendar dates and exclude blocked and out-of-range visits', () => {
  const today = new Date(2026,9,21,12);
  const visits = [
    {at:new Date(2026,9,21,0,1).toISOString(),outcome:'ok'},
    {at:new Date(2026,9,21,23,59).toISOString(),outcome:'ok'},
    {at:new Date(2026,9,20,23,59).toISOString(),outcome:'ok'},
    {at:today.toISOString(),outcome:'limit'},
    {at:new Date(2026,9,1).toISOString(),outcome:'ok'},
  ];
  const points = dailyActivity(visits,7,today);
  assert.equal(points.length,7);
  assert.equal(points[6].count,2);
  assert.equal(points[5].count,1);
  assert.equal(points.reduce((s,p) => s+p.count,0),3);
});

test('search, status and deterministic sorting compose without modifying records', () => {
  const links = [{id:1,title:'Курс',url:'https://example.com/python',code:'abc',status:'active',clicks:3},
    {id:2,title:'Курс Go',url:'https://example.com/go',code:'def',status:'paused',clicks:3},
    {id:3,title:'Портфолио',url:'https://example.com/profile',code:'ghi',status:'active',clicks:10}];
  assert.deepEqual(filterLinks(links,' КУРС ','active','new').map(l=>l.id),[1]);
  assert.deepEqual(filterLinks(links,'example.com','all','clicks').map(l=>l.id),[3,2,1]);
  assert.deepEqual(links.map(l=>l.id),[1,2,3]);
});

test('source percentages use all visits even when the list is truncated', () => {
  const result = groupVisits([{referrer:'a'},{referrer:'a'},{referrer:'b'},{referrer:'c'}],'referrer',1);
  assert.equal(result[0].percent,50);
  assert.deepEqual(groupVisits([],'referrer'),[]);
});
