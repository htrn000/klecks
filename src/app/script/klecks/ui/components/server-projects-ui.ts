import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import { RemoteProjectStore, TRemoteProjectMeta } from '../../storage/remote-project-store';
import { TKlProject } from '../../kl-types';

export class ServerProjectsUi {
    private readonly root: HTMLElement;
    private readonly store: RemoteProjectStore;
    private readonly getProject: () => TKlProject;
    private readonly applyUncommitted: () => void;
    private readonly onOpen: (id: string) => void;

    constructor(p: { store: RemoteProjectStore; getProject: () => TKlProject; applyUncommitted: () => void; onOpen: (id: string) => void }) {
        this.store = p.store;
        this.getProject = p.getProject;
        this.applyUncommitted = p.applyUncommitted;
        this.onOpen = p.onOpen;
        this.root = BB.el({ css: { margin: '10px 10px 0 10px', display: 'none' } });
        void this.initialize();
    }

    private async initialize(): Promise<void> {
        if (!(await this.store.isAvailable())) return;
        this.root.style.display = '';
        this.root.append(BB.el({ tagName: 'h3', textContent: LANG('server-projects-title') }));
        const save = BB.el({ tagName: 'button', className: 'kl-button', textContent: LANG('server-projects-save'), css: { width: '100%' }, onClick: () => void this.save() });
        const list = BB.el({ css: { marginTop: 8 } });
        this.root.append(save, list);
        await this.refresh(list);
    }

    private async save(): Promise<void> {
        const project = this.getProject();
        const name = window.prompt(LANG('server-projects-name'), project.projectId || 'Untitled');
        if (name === null) return;
        try {
            this.applyUncommitted();
            await this.store.store(this.getProject(), name);
            await this.refresh(this.root.lastElementChild as HTMLElement);
        } catch (error) {
            window.alert(`${LANG('server-projects-failed')}: ${error instanceof Error ? error.message : error}`);
        }
    }

    private async refresh(list: HTMLElement): Promise<void> {
        list.replaceChildren();
        let projects: TRemoteProjectMeta[];
        try { projects = await this.store.list(); } catch { this.root.style.display = 'none'; return; }
        if (!projects.length) list.append(BB.el({ textContent: LANG('server-projects-empty') }));
        for (const project of projects) {
            const open = BB.el({ tagName: 'button', className: 'kl-button', textContent: `${project.name} · ${new Date(project.updatedAt).toLocaleString()}`, css: { flex: '1', textAlign: 'left' }, onClick: () => this.onOpen(project.id) });
            const image = BB.el({ tagName: 'img', props: { src: this.store.thumbnailUrl(project.id), alt: '' }, css: { width: 48, height: 48, objectFit: 'contain' } });
            const remove = BB.el({ tagName: 'button', className: 'kl-button', textContent: LANG('server-projects-delete'), onClick: async () => { if (window.confirm(LANG('server-projects-delete-confirm'))) { await this.store.clear(project.id); await this.refresh(list); } } });
            list.append(BB.el({ content: [image, open, remove], css: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 } }));
        }
    }

    getElement(): HTMLElement { return this.root; }
}
