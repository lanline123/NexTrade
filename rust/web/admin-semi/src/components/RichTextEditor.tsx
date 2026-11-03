import { useEffect, useRef, useState } from 'react';
import { Toast } from '@douyinfe/semi-ui';
import '@wangeditor/editor/dist/css/style.css';
import { Editor, Toolbar } from '@wangeditor/editor-for-react';
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor';
import { apiUpload } from '../api';
import { useI18n } from '../i18n';

interface UploadResult {
  picUrl: string;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  height?: number;
  placeholder?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  height = 360,
  placeholder,
}: RichTextEditorProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t('请输入商品详情...');
  const [editor, setEditor] = useState<IDomEditor | null>(null);
  // 记录最近一次内部 onChange 吐出的 HTML,用于区分"外部灌入"与"内部回流"
  const lastEmittedRef = useRef<string>('');

  const toolbarConfig: Partial<IToolbarConfig> = {
    excludeKeys: ['fullScreen', 'group-video'],
  };
  const editorConfig: Partial<IEditorConfig> = {
    placeholder: resolvedPlaceholder,
    MENU_CONF: {
      uploadImage: {
        async customUpload(file: File, insertFn: (url: string, alt: string, href: string) => void) {
          try {
            const result = await apiUpload<UploadResult>(
              '/setting/galleryPic/uploadImg?galleryId=0',
              file,
            );
            insertFn(result.picUrl, file.name, result.picUrl);
          } catch (error) {
            Toast.error({ content: error instanceof Error ? error.message : t('图片上传失败') });
          }
        },
      },
    },
  };

  useEffect(() => {
    return () => {
      if (editor) {
        try {
          editor.destroy();
        } catch {
          // 卸载竞态时 destroy 可能抛错,忽略
        }
        setEditor(null);
      }
    };
  }, [editor]);

  // 外部 value → 编辑器的单向同步:编辑器保持非受控(不经 <Editor value>),
  // 避免受控回灌与手动 setHtml 双路径竞争导致的 Slate "Cannot resolve a DOM node" 异常。
  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return; // 内部 onChange 的回流,跳过
    if (value === editor.getHtml()) return; // 归一化后内容一致,跳过
    // 延迟到 DOM 稳定后执行
    const timer = window.setTimeout(() => {
      try {
        editor.setHtml(value || '');
      } catch {
        // 个别历史内容无法映射为 Slate 节点时降级为空,保持编辑器可用
        try {
          editor.setHtml('');
        } catch {
          // 忽略
        }
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [value, editor]);

  return (
    <div className="rich-editor">
      <Toolbar
        editor={editor}
        defaultConfig={toolbarConfig}
        mode="default"
        style={{ borderBottom: '1px solid #e6eaf0' }}
      />
      <Editor
        defaultHtml={value || ''}
        onCreated={(instance) => {
          setEditor(instance);
          lastEmittedRef.current = instance.getHtml();
        }}
        onChange={(instance) => {
          const html = instance.getHtml();
          lastEmittedRef.current = html;
          onChange(html);
        }}
        mode="default"
        style={{ height, overflowY: 'hidden' }}
      />
    </div>
  );
}
