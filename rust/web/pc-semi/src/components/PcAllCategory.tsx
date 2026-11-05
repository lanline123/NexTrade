'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Down from '@icon-park/react/es/icons/Down';
import HamburgerButton from '@icon-park/react/es/icons/HamburgerButton';

type CatNode = Record<string, any>;

type Floor = {
  catFloorId?: string | number;
  catList?: CatNode[];
  catFloorNames?: Array<Record<string, any>>;
  imageUrl?: string;
  useImage?: number;
};

function catId(cat: CatNode): string {
  return String(cat.categoryId ?? cat.id ?? '');
}

function catName(cat: CatNode): string {
  return String(cat.categoryName ?? cat.name ?? '').trim();
}

function catLink(cat: CatNode, pId?: string | number): string {
  const id = catId(cat);
  const link = String(cat.categoryLink || '').trim();
  if (link && link !== 'list') return /^(?:(?:https?:)?\/\/|\/|#|mailto:|tel:)/i.test(link) ? link : `/${link}`;
  return `/list?categoryId=${encodeURIComponent(id)}${pId ? `&pId=${encodeURIComponent(String(pId))}` : ''}`;
}

function floorNames(floor: Floor): string[] {
  const names = Array.isArray(floor.catFloorNames) ? floor.catFloorNames : [];
  const list = names.map((item) => String(item.categoryTitleName ?? '').trim()).filter((name) => name && name !== '-');
  if (list.length) return list;
  return (floor.catList || []).map(catName).filter((name) => name && name !== '-');
}

export default function PcAllCategory() {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    fetch('/api/common/pc/getCatFloor')
      .then((response) => response.json())
      .then((json) => {
        const list = json?.data?.catFloor || json?.catFloor || [];
        setFloors(Array.isArray(list) ? list.filter((floor: Floor) => (floor.catList || []).length > 0) : []);
      })
      .catch(() => undefined);
  }, []);

  const current = floors[active];

  return (
    <div className="category-wrap white" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      <div className="category-trigger">
        <div className="bar-wrap">
          <div className="content">
            <div className="icon" aria-hidden="true"><HamburgerButton size={16} /></div>
            <div className="txt">分类</div>
            <div className="icon ml"><Down className={`arrow${visible ? ' rotate' : ''}`} size={14} /></div>
          </div>
        </div>
        {visible ? (
          <div className="category-dropdown">
            <div className="popover-cate-content">
              {floors.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center' }}>暂无分类数据</div>
              ) : (
                <div className="category-content-wrapper">
                  <div className="left-wrap">
                    {floors.map((floor, index) => (
                      <div
                        key={`${String(floor.catFloorId || 'floor')}-${index}`}
                        className={`cate_menu_item${index === active ? ' active' : ''}`}
                        onMouseEnter={() => setActive(index)}
                      >
                        <span className="cate_menu_icon">
                          {floor.useImage === 1 && floor.imageUrl ? (
                            <img className="cate_menu_icon_img" src={floor.imageUrl} alt={floorNames(floor).join('/')} />
                          ) : null}
                        </span>
                        <div className="cate_menu_text">
                          <span className="cate_menu_text_inner">
                            {floorNames(floor).map((name, nameIndex) => (
                              <span key={nameIndex}>
                                <Link target="_blank" className="cate_menu_lk" href={`/list?pId=${encodeURIComponent(String(floor.catFloorId ?? ''))}`} onClick={(event) => event.stopPropagation()}>
                                  {name}
                                </Link>
                                {nameIndex < floorNames(floor).length - 1 ? <span className="cate_menu_line">/</span> : null}
                              </span>
                            ))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="right-wrap">
                    {current ? (
                      <div className="cate-item-wrap">
                        <div className="cate-title-row">
                          {floorNames(current).map((name, index) => (
                            <span key={index}>
                              <span className="cate-title">{name}</span>
                              {index < floorNames(current).length - 1 ? <span className="cate-menu-line">、</span> : null}
                            </span>
                          ))}
                        </div>
                        <div className="second-class-container">
                          {(current.catList || []).map((cat) => {
                            const children = Array.isArray(cat.children) ? cat.children : [];
                            if (children.length) {
                              return children.map((child: CatNode, childIndex: number) => (
                                <Link key={`${catId(child)}-${childIndex}`} target="_blank" className={`second-class-item${child.categoryPic || child.pic ? '' : ' no-img'}`} href={catLink(child, current.catFloorId)}>
                                  {child.categoryPic || child.pic ? <div className="item-pic"><img src={String(child.categoryPic || child.pic)} alt={catName(child)} /></div> : null}
                                  <div className="item-name">{catName(child)}</div>
                                </Link>
                              ));
                            }
                            if (!catName(cat) && !cat.categoryPic && !cat.pic) return null;
                            return (
                              <Link key={catId(cat)} target="_blank" className={`second-class-item${cat.categoryPic || cat.pic ? '' : ' no-img'}`} href={catLink(cat, current.catFloorId)}>
                                {cat.categoryPic || cat.pic ? <div className="item-pic"><img src={String(cat.categoryPic || cat.pic)} alt={catName(cat)} /></div> : null}
                                <div className="item-name">{catName(cat)}</div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
