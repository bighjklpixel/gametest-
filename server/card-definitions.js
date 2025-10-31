function makeCard(template) {
    const powerValue = template.power || 0;
    const newCard = {
        ...template,
        power: powerValue,
        currentPower: powerValue,
        isTapped: false,
        attachments: [],
        abilities: [],
        id: `${template.name.replace(/\s/g, '')}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`
    };
    if (template.abilities) {
        newCard.abilities = [...template.abilities];
    }
    return newCard;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

const allCardTemplates = [
    // === AVATARS ===
    // เดิม
    {
        name: 'นาย',
        imageId: '1',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 2,
        gemValue: 2,
        power: 2,
        description: '【จุติ】ถ้า Avatar ตัวนี้ถูกอัญเชิญแบบจ่าย Cost\nนำ Avatar ชื่อ "กุ่ย" 1 ใบจาก Deck ขึ้นมือ หลังจากนั้นสับ Deck\n\n【สามัคคี】(เปลี่ยนการ์ดนี้เป็นสภาพนอน)\nนำ POWER +2 ไปเพิ่มให้กับ Avatar ที่สั่งโจมตี',
        effect: {
            juti: { action: 'searchDeck', cardName: 'กุ่ย' },
            samakkhi: { action: 'buffAttacker', power: 2 }
        }
    },
    {
        name: 'กุ่ย',
        imageId: '2',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 2,
        gemValue: 2,
        power: 2,
        description: '【จุติ】ถ้า Avatar ตัวนี้ถูกอัญเชิญแบบจ่าย Cost\nนำ Avatar ชื่อ "ฮอน" 1 ใบจาก Deck ขึ้นมือ หลังจากนั้นสับ Deck\n\n【สามัคคี】(เปลี่ยนการ์ดนี้เป็นสภาพนอน)\nนำ POWER +2 ไปเพิ่มให้กับ Avatar ที่สั่งโจมตี',
        effect: {
            juti: { action: 'searchDeck', cardName: 'ฮอน' },
            samakkhi: { action: 'buffAttacker', power: 2 }
        }
    },
    {
        name: 'ฮอน',
        imageId: '3',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 2,
        gemValue: 2,
        power: 2,
        description: '【จุติ】ถ้า Avatar ตัวนี้ถูกอัญเชิญแบบจ่าย Cost\nนำ Avatar ชื่อ "นาย" 1 ใบจาก Deck ขึ้นมือ หลังจากนั้นสับ Deck\n\n【สามัคคี】(เปลี่ยนการ์ดนี้เป็นสภาพนอน)\nนำ POWER +2 ไปเพิ่มให้กับ Avatar ที่สั่งโจมตี',
        effect: {
            juti: { action: 'searchDeck', cardName: 'นาย' },
            samakkhi: { action: 'buffAttacker', power: 2 }
        }
    },
    {
        name: 'ครูภาษาไทย',
        imageId: '4',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 0,
        gemValue: 4,
        power: 0,
        description: 'Avatar ไม่มีความสามารถพิเศษ'
    },
    {
        name: 'ลุงข้างห้อง',
        imageId: '5',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 0,
        gemValue: 0,
        power: 1,
        description: 'Avatar ไม่มีความสามารถพิเศษ'
    },
    {
        name: 'นักเรียน แบงค์',
        imageId: '6',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 1,
        gemValue: 1,
        power: 3,
        description: 'Avatar ไม่มีความสามารถพิเศษ'
    },
    {
        name: 'เด็กไม่ชอบแมลงสาบมากๆ',
        imageId: '7',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 1,
        gemValue: 1,
        power: 4,
        description: 'Avatar ไม่มีความสามารถพิเศษ'
    },
    {
        name: 'แท็กซี่ตีนเปล่า',
        imageId: '8',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 1,
        gemValue: 2,
        power: 2,
        description: 'Avatar ไม่มีความสามารถพิเศษ'
    },
    {
        name: 'ไอดำ',
        imageId: '9',
        type: 'Avatar',
        tribe: 'สัตว์',
        cost: 1,
        gemValue: 3,
        power: 1,
        description: 'Avatar ไม่มีความสามารถพิเศษ'
    },
    {
        name: 'ตำรวจ',
        imageId: '10',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 2,
        gemValue: 3,
        power: 2,
        description: 'Avatar ไม่มีความสามารถพิเศษ'
    },
    {
        name: 'ป๊อด เด็กติดยา',
        imageId: '11',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 4,
        gemValue: 2,
        power: 4,
        description: 'Avatar ไม่มีความสามารถพิเศษ'
    },
    {
        name: 'รัททาทูย ผู้พิทักษ์ราชินี',
        imageId: '12',
        type: 'Avatar',
        tribe: 'สัตว์',
        cost: 5,
        gemValue: 3,
        power: 5,
        description: 'Avatar ไม่มีความสามารถพิเศษ'
    },
    {
        name: 'อนาถา เด็กไม่ชอบแมลงสาบ',
        imageId: '23',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 0,
        gemValue: 1,
        power: 3,
        description: 'Avatar ไม่มีความสามารถพิเศษ'
    },
    {
        name: 'ริกกี้ เพื่อนรัก',
        imageId: '24',
        type: 'Avatar',
        tribe: 'แมลงสาบ',
        cost: 3,
        gemValue: 2,
        power: 1,
        description: '【จุติ】ถ้า Avatar ตัวนี้ถูกอัญเชิญแบบจ่าย Cost\nนำการ์ดชื่อ "กุ่ย", "ฮอน" หรือ "นาย" ได้สูงสุด 3 ใบจากนรกกลับเข้า Deck\nหลังจากนั้นสับ Deck แล้วจั่วการ์ด 1 ใบ',
        effect: { juti: { action: 'graveyardToDeckAndDraw', targetNames: ['กุ่ย', 'ฮอน', 'นาย'], maxTargets: 3, drawValue: 1 } }
    },
    {
        name: 'วีรบุรุษปากซอย',
        imageId: '25',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 6,
        gemValue: 3,
        power: 6,
        rarity: 'Only#1',
        description: '【จุติ】ถ้า Avatar ตัวนี้ถูกอัญเชิญแบบจ่าย Cost\nนำ Avatar ชื่อ "กุ่ย", "ฮอน" และ "นาย" อย่างละ 1 ใบจากนรกขึ้นมือ',
        effect: { juti: { action: 'graveyardToHand', targetNames: ['กุ่ย', 'ฮอน', 'นาย'], unique: true } }
    },

    // === การ์ดใหม่ที่มี Keywords เพิ่มเติม ===

    // การ์ดที่มี คำสั่งเสีย
    {
        name: 'นักรบผู้กล้า',
        imageId: '26',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 3,
        gemValue: 2,
        power: 4,
        description: '【คำสั่งเสีย】เมื่อ Avatar นี้ถูกทำลายจากสนาม\nจั่วการ์ด 2 ใบ',
        effect: {
            onDestroy: { action: 'drawCard', value: 2 }
        }
    },

    // การ์ดที่มี เซ่นไหว้
    {
        name: 'พระสงฆ์',
        imageId: '27',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 4,
        gemValue: 2,
        power: 3,
        description: '【จุติ】เมื่อ Avatar นี้ถูกอัญเชิญ\n【เซ่นไหว้】ทำลาย Avatar 1 ใบที่มี Power 2 หรือน้อยกว่า',
        effect: {
            juti: {
                action: 'special',
                senWai: {
                    targetType: 'Avatar',
                    targetZone: 'field',
                    targetOwner: 'opponent',
                    condition: { powerLessThanOrEqual: 2 }
                }
            }
        }
    },

    // การ์ดที่มี พอดี
    {
        name: 'นักเวทผู้แม่นยำ',
        imageId: '28',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 3,
        gemValue: 1,
        power: 3,
        description: '【พอดี】เมื่อ Avatar นี้ถูกอัญเชิญด้วย Gem พอดี Cost\nAvatar นี้ได้รับ Power +2 และจั่วการ์ด 1 ใบ',
        effect: {
            poDee: { action: 'gainPowerAndDraw', power: 2, drawValue: 1 }
        }
    },

    // การ์ดที่มี ลูกอึด
    {
        name: 'นักสู้ดื้อดึง',
        imageId: '29',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 2,
        gemValue: 1,
        power: 2,
        abilities: ['ลูกอึด'],
        description: '【ลูกอึด】เมื่อ Avatar นี้ต่อสู้กับ Avatar ที่มี Power เท่ากันและไม่มีลูกอึด\nAvatar นี้จะเป็นฝ่ายชนะ'
    },

    // การ์ดที่มี โล่มนุษย์
    {
        name: 'องครักษ์',
        imageId: '30',
        type: 'Avatar',
        tribe: 'มนุษย์',
        cost: 3,
        gemValue: 2,
        power: 5,
        description: '【โล่มนุษย์】(Tap การ์ดนี้)\nเมื่อฝ่ายตรงข้ามประกาศโจมตี เปลี่ยนเป้าหมายมาที่การ์ดนี้แทน',
        effect: {
            loManut: { action: 'redirect' }
        }
    },

    // การ์ดที่มี แทงหลัง
    {
        name: 'มือสังหาร',
        imageId: '31',
        type: 'Avatar',
        tribe: 'โจร',
        cost: 1,
        gemValue: 1,
        power: 1,
        description: '【แทงหลัง】(Tap การ์ดนี้)\nเพิ่ม Power +1 ให้ Avatar ที่โจมตี\nแต่ถ้า Avatar นั้นเป็นคนละ Tribe กับการ์ดนี้ จะถูกทำลายหลังการต่อสู้',
        effect: {
            tangLang: { power: 1 }
        }
    },

    // === CONSTRUCT (ยูนิตสนับสนุน) ===
    {
        name: 'หอสังเกตการณ์',
        imageId: '32',
        type: 'Construct',
        cost: 2,
        gemValue: 1,
        power: 3,
        description: '【ต่อเนื่อง】Avatar ของคุณทุกใบ ได้รับ Power +1\n(Construct ไม่สามารถโจมตีได้)',
        effect: {
            continuous: { targetOwner: 'self', buff: { power: 1 } }
        }
    },

    {
        name: 'กำแพงป้องกัน',
        imageId: '33',
        type: 'Construct',
        cost: 1,
        gemValue: 1,
        power: 5,
        description: 'Construct นี้ไม่มีความสามารถพิเศษ\n(Construct ไม่สามารถโจมตีได้)'
    },

    // === MAGIC การ์ดใหม่ ===

    // การ์ดที่มี สอดแนม
    {
        name: 'ลูกแก้ววิเศษ',
        imageId: '34',
        type: 'Magic',
        subType: 'Normal',
        cost: 1,
        gemValue: 1,
        description: '【สอดแนม】ดูการ์ด 3 ใบบนสุดของ Deck\nเรียงลำดับใหม่ตามต้องการแล้ววางกลับ',
        effect: {
            sodNam: { count: 3, target: 'self' }
        }
    },

    // การ์ดที่มี ธีรสูป
    {
        name: 'คลื่นทำลายล้าง',
        imageId: '35',
        type: 'Magic',
        subType: 'Normal',
        cost: 2,
        gemValue: 1,
        description: '【ธีรสูป】ส่งการ์ด 3 ใบบนสุดจาก Deck ของฝ่ายตรงข้ามลงนรก',
        effect: {
            teeRaSup: { count: 3, target: 'opponent' }
        }
    },

    // การ์ดที่มี เลือกปฏิบัติ
    {
        name: 'ทางแยก',
        imageId: '36',
        type: 'Magic',
        subType: 'Normal',
        cost: 1,
        gemValue: 1,
        description: '【เลือกปฏิบัติ】เลือก 1:\n• จั่วการ์ด 2 ใบ\n• ทำลาย Construct 1 ใบ',
        effect: {
            luakPatibat: {
                options: [
                    { action: 'drawCard', value: 2 },
                    {
                        senWai: {
                            targetType: 'Construct',
                            targetZone: 'field',
                            targetOwner: 'opponent'
                        }
                    }
                ]
            }
        }
    },

    // การ์ดที่มี เทิร์นละครั้ง
    {
        name: 'พิธีกรรมพลังงาน',
        imageId: '37',
        type: 'Magic',
        subType: 'Normal',
        cost: 0,
        gemValue: 2,
        description: '【เทิร์นละครั้ง】ใช้ได้ 1 ครั้งต่อเทิร์น\nจั่วการ์ด 1 ใบ',
        effect: {
            oncePerTurn: true,
            action: 'drawCard',
            value: 1
        }
    },

    // การ์ดที่มี สั่งใช้
    {
        name: 'แท่นบูชา',
        imageId: '38',
        type: 'Magic',
        subType: 'Land',
        cost: 2,
        gemValue: 1,
        description: '【สั่งใช้】(Tap การ์ดนี้)\nสังเวย Avatar 1 ใบจากสนาม → จั่วการ์ด 2 ใบ\nใช้ได้ 1 ครั้งต่อเทิร์น',
        effect: {
            sangChai: {
                oncePerTurn: true,
                requiresSacrifice: true,
                sacrificeTargets: { type: 'Avatar', count: 1, zone: 'field' },
                action: 'drawCard',
                value: 2
            }
        }
    },

    // === MAGICS เดิม ===
    {
        name: 'ไม้เก่าหลัง',
        imageId: '13',
        type: 'Magic',
        subType: 'Mod',
        cost: 1,
        gemValue: 1,
        description: 'ติดการ์ดนี้ใส่ Avatar 1 ใบในสนาม\n\nAvatar ที่สวมใส่ได้รับความสามารถ "เตะไข่"\n\n【เตะไข่】Avatar นี้โจมตี Life Card ได้โดยตรง',
        effect: { grantAbility: 'เตะไข่' }
    },
    {
        name: 'สมชายห้องเช่าถูกๆ',
        imageId: '14',
        type: 'Magic',
        subType: 'Land',
        cost: 1,
        gemValue: 1,
        description: '【สถานที่】วางการ์ดนี้ลงสนาม\n\n【ต่อเนื่อง】เมื่อ Avatar ชื่อ "กุ่ย", "ฮอน" หรือ "นาย" สั่งโจมตี\nเพิ่ม POWER +2 ให้กับ Avatar นั้น',
        effect: {
            kind: 'onAttackDeclarationBuff',
            targetNames: ['กุ่ย', 'ฮอน', 'นาย'],
            buff: { power: 2 }
        }
    },
    {
        name: 'สละเพื่อนเพื่อช่วยเพื่อน',
        imageId: '15',
        type: 'Magic',
        subType: 'Normal',
        cost: 0,
        gemValue: 1,
        description: '【เทิร์นละครั้ง】ใช้ได้ 1 ครั้งต่อเทิร์น\n\nส่ง Avatar ชื่อ "กุ่ย", "ฮอน" หรือ "นาย" 1 ใบจากมือหรือสนามลงนรก\n\n→ นำ Avatar 1 ใบในสนามฝ่ายตรงข้ามกลับเข้ามือ',
        effect: {
            kind: 'sacrificeAndBounce',
            requiresSacrifice: true,
            oncePerTurn: true,
            sacrificeTargets: {
                names: ['กุ่ย', 'ฮอน', 'นาย'],
                zones: ['hand', 'field']
            }
        }
    },
    {
        name: 'บำเพ็ญประโยชน์',
        imageId: '16',
        type: 'Magic',
        subType: 'Normal',
        cost: 0,
        gemValue: 1,
        description: '【เทิร์นละครั้ง】ใช้ได้ 1 ครั้งต่อเทิร์น\n\nส่ง Avatar ชื่อ "กุ่ย", "ฮอน" หรือ "นาย" 1 ใบจากมือลงนรก\n\n→ จั่วการ์ด 2 ใบ',
        effect: {
            kind: 'sacrificeAndDraw',
            requiresSacrifice: true,
            oncePerTurn: true,
            sacrificeTargets: {
                names: ['กุ่ย', 'ฮอน', 'นาย'],
                zones: ['hand']
            },
            drawValue: 2
        }
    },
    {
        name: 'ระเบิด Very Fat Man',
        imageId: '17',
        type: 'Magic',
        subType: 'React',
        cost: 0,
        gemValue: 1,
        description: '【แก้ไข】ใช้ความสามารถตอบโต้ได้ ใช้ได้สูงสุด 1 ครั้งต่อ 1 เทิร์น\n\nส่ง Avatar ชื่อ "กุ่ย", "ฮอน" และ "นาย" อย่างละ 1 ใบจากมือและ/หรือสนามลงนรก\n\n→ ทำลาย Avatar ทุกใบในสนามฝ่ายตรงข้าม',
        effect: {
            kind: 'sacrificeAndBoardWipe',
            requiresSacrifice: true,
            sacrificeTargets: {
                names: ['กุ่ย', 'ฮอน', 'นาย'],
                unique: true,
                count: 3,
                zones: ['hand', 'field']
            }
        }
    },

    // === LIFE CARDS ===
    {
        name: 'ไม่นะ, ครู!',
        imageId: '18',
        type: 'Life',
        description: '【เปิดประจัก】ใช้ความสามารถนี้ได้ 1 ครั้งต่อ 1 เทิร์น\n\nใน Main Phase ถัดไป จั่วการ์ด 1 ใบ',
        effect: { lifeEffect: { action: 'drawCard', value: 1 } }
    },
    {
        name: 'ไม่นะไอ้กุ่ย!',
        imageId: '19',
        type: 'Life',
        description: '【เปิดประจัก】ใช้ความสามารถนี้ได้ 1 ครั้งต่อ 1 เทิร์น\n\nใน Main Phase ถัดไป จั่วการ์ด 1 ใบ',
        effect: { lifeEffect: { action: 'drawCard', value: 1 } }
    },
    {
        name: 'ไม่นะจาบาล!',
        imageId: '20',
        type: 'Life',
        description: '【เปิดประจัก】ใช้ความสามารถนี้ได้ 1 ครั้งต่อ 1 เทิร์น\n\nใน Main Phase ถัดไป จั่วการ์ด 1 ใบ',
        effect: { lifeEffect: { action: 'drawCard', value: 1 } }
    },
    {
        name: 'ไม่นะไอ้นาย!',
        imageId: '21',
        type: 'Life',
        description: '【เปิดประจัก】ใช้ความสามารถนี้ได้ 1 ครั้งต่อ 1 เทิร์น\n\nใน Main Phase ถัดไป จั่วการ์ด 1 ใบ',
        effect: { lifeEffect: { action: 'drawCard', value: 1 } }
    },
    {
        name: 'ไม่นะไอ้ฮอน!',
        imageId: '22',
        type: 'Life',
        description: '【เปิดประจัก】ใช้ความสามารถนี้ได้ 1 ครั้งต่อ 1 เทิร์น\n\nใน Main Phase ถัดไป จั่วการ์ด 1 ใบ',
        effect: { lifeEffect: { action: 'drawCard', value: 1 } }
    }
];

function createLifeDeck() {
    const lifeCards = allCardTemplates.filter(c => c.type === 'Life');
    return shuffleDeck(lifeCards).slice(0, 5).map(t => makeCard(t));
}

function createMasterDeck(deckName = 'starter_pasulol') {
    const deck = [];
    const mainDeckPool = allCardTemplates.filter(c => c.type !== 'Life');
    const onlyOneCards = mainDeckPool.filter(c => c.rarity === 'Only#1');

    onlyOneCards.forEach(card => {
        deck.push(makeCard(card));
    });

    // สำหรับ starter deck
    if (deckName === 'starter_pasulol') {
        // เพิ่มการ์ดหลักของเด็ค
        const coreCards = [
            'นาย', 'กุ่ย', 'ฮอน', // 3 ใบซ้ำ
            'นาย', 'กุ่ย', 'ฮอน',
            'นาย', 'กุ่ย', 'ฮอน',
            'ริกกี้ เพื่อนรัก', 'ริกกี้ เพื่อนรัก',
            'ไม้เก่าหลัง', 'ไม้เก่าหลัง',
            'สมชายห้องเช่าถูกๆ',
            'สละเพื่อนเพื่อช่วยเพื่อน', 'สละเพื่อนเพื่อช่วยเพื่อน',
            'บำเพ็ญประโยชน์', 'บำเพ็ญประโยชน์',
            'ระเบิด Very Fat Man'
        ];

        coreCards.forEach(cardName => {
            const template = mainDeckPool.find(c => c.name === cardName);
            if (template && template.rarity !== 'Only#1') {
                deck.push(makeCard(template));
            }
        });
    }

    // เติมการ์ดให้ครบ 50 ใบ
    while (deck.length < 50) {
        const randomCardTemplate = mainDeckPool[Math.floor(Math.random() * mainDeckPool.length)];
        if (randomCardTemplate.rarity === 'Only#1') continue;
        const count = deck.filter(c => c.name === randomCardTemplate.name).length;
        if (count < 4) {
            deck.push(makeCard(randomCardTemplate));
        }
    }

    return shuffleDeck(deck);
}

module.exports = {
    makeCard,
    createMasterDeck,
    createLifeDeck,
    shuffleDeck
};
