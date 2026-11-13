import { randomUuid } from '../../../bb/base/base';
import { BB } from '../../../bb/bb';
import { LANG } from '../../../language/language';
import {
    createNewServerProjectId,
    getServerSaveDecision,
    RemoteProjectStore,
    TRemoteProjectMeta,
} from '../../storage/remote-project-store';
import { TKlProject } from '../../kl-types';

export class ServerProjectsUi {
    private readonly root: HTMLElement;
    private readonly store: RemoteProjectStore;
    private readonly getProject: () => TKlProject;
    private readonly applyUncommitted: () => void;
    private readonly onOpen: (id: string) => Promise<void>;
    private readonly onSetProjectId: (id: string) => void;
    private readonly onSaved: (name: string) => void;
    private currentEl: HTMLElement | undefined;
    private listEl: HTMLElement | undefined;
    private projects: TRemoteProjectMeta[] = [];

    constructor(p: {
        store: RemoteProjectStore;
        getProject: () => TKlProject;
        applyUncommitted: () => void;
        onOpen: (id: string) => Promise<void>;
        onSetProjectId: (id: string) => void;
        onSaved: (name: string) => void;
    }) {
        this.store = p.store;
        this.getProject = p.getProject;
        this.applyUncommitted = p.applyUncommitted;
        this.onOpen = p.onOpen;
        this.onSetProjectId = p.onSetProjectId;
        this.onSaved = p.onSaved;
        this.root = BB.el({ css: { margin: '10px 10px 0 10px', display: 'none' } });
        this.root.dataset.serverProjects = 'true';
        void this.initialize();
    }

    private async initialize(): Promise<void> {
        if (!(await this.store.isAvailable())) return;
        this.root.style.display = '';
        this.root.append(BB.el({ tagName: 'h3', textContent: LANG('server-projects-title') }));
        this.currentEl = BB.el({ css: { margin: '0 0 8px' } });
        const save = BB.el({
            tagName: 'button', className: 'kl-button', textContent: LANG('server-projects-save'),
            css: { width: '100%' }, onClick: () => void this.save(),
        });
        const saveAsNew = BB.el({
            tagName: 'button', className: 'kl-button', textContent: LANG('server-projects-save-as-new'),
            css: { width: '100%', marginTop: 5 }, onClick: () => void this.saveAsNew(),
        });
        this.listEl = BB.el({ css: { marginTop: 8 } });
        this.root.append(this.currentEl, save, saveAsNew, this.listEl);
        await this.refresh();
    }

    async refresh(): Promise<void> {
        if (!this.listEl) return;
        try {
            this.projects = await this.store.list();
        } catch {
            this.root.style.display = 'none';
            return;
        }
        this.listEl.replaceChildren();
        if (!this.projects.length) this.listEl.append(BB.el({ textContent: LANG('server-projects-empty') }));
        for (const project of this.projects) this.listEl.append(this.createProjectRow(project));
        this.refreshCurrentBinding();
    }

    /** Update the binding label/highlight without fetching the project list on every edit. */
    refreshCurrentBinding(): void {
        if (!this.currentEl || !this.listEl) return;
        const currentId = this.getProject().projectId;
        const decision = getServerSaveDecision(currentId, this.projects);
        this.currentEl.textContent = decision.action === 'update'
            ? `${LANG('server-projects-current')}: ${decision.project.name}`
            : LANG('server-projects-not-saved');
        for (const row of this.listEl.children) {
            const projectId = (row as HTMLElement).dataset.projectId;
            const isCurrent = projectId === currentId;
            (row as HTMLElement).style.background = isCurrent ? 'var(--kl-color-bg-2, rgba(127,127,127,.16))' : '';
            (row as HTMLElement).style.borderRadius = '4px';
        }
    }

    private createProjectRow(project: TRemoteProjectMeta): HTMLElement {
        const open = BB.el({
            tagName: 'button', className: 'kl-button',
            textContent: `${project.name} · ${new Date(project.updatedAt).toLocaleString()}`,
            css: { flex: '1', textAlign: 'left', minWidth: 0 },
            onClick: () => void this.open(project.id),
        });
        const image = BB.el({
            tagName: 'img', props: { src: this.store.thumbnailUrl(project.id), alt: '' },
            css: { width: 48, height: 48, objectFit: 'contain' },
        });
        const rename = BB.el({
            tagName: 'button', className: 'kl-button', textContent: LANG('server-projects-rename'),
            onClick: () => void this.rename(project),
        });
        const remove = BB.el({
            tagName: 'button', className: 'kl-button', textContent: LANG('server-projects-delete'),
            onClick: () => void this.remove(project),
        });
        const row = BB.el({
            content: [image, open, rename, remove],
            css: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, padding: 3 },
        });
        (row as HTMLElement).dataset.projectId = project.id;
        return row;
    }

    private async save(): Promise<void> {
        try {
            this.applyUncommitted();
            const project = this.getProject();
            const existing = getServerSaveDecision(project.projectId, this.projects);
            const name = existing.action === 'update'
                ? existing.project.name
                : window.prompt(LANG('server-projects-name'), this.defaultName());
            if (name === null || name === undefined || !name.trim()) return;
            await this.store.store(this.getProject(), name.trim(), project.projectId);
            this.onSaved(name.trim());
            await this.refresh();
        } catch (error) {
            this.reportError(error);
        }
    }

    private async saveAsNew(): Promise<void> {
        try {
            this.applyUncommitted();
            const current = this.getProject();
            const currentProject = this.projects.find((item) => item.id === current.projectId);
            const defaultName = currentProject ? `${currentProject.name} copy` : this.defaultName();
            const name = window.prompt(LANG('server-projects-name'), defaultName);
            if (name === null || !name.trim()) return;
            const id = createNewServerProjectId(current.projectId, randomUuid);
            this.onSetProjectId(id);
            await this.store.store(this.getProject(), name.trim(), id);
            this.onSaved(name.trim());
            await this.refresh();
        } catch (error) {
            this.reportError(error);
        }
    }

    private async open(id: string): Promise<void> {
        try {
            await this.onOpen(id);
            await this.refresh();
        } catch (error) {
            this.reportError(error);
        }
    }

    private async rename(project: TRemoteProjectMeta): Promise<void> {
        const name = window.prompt(LANG('server-projects-rename-prompt'), project.name);
        if (name === null || !name.trim()) return;
        try {
            await this.store.rename(project.id, name.trim());
            await this.refresh();
        } catch (error) {
            this.reportError(error);
        }
    }

    private async remove(project: TRemoteProjectMeta): Promise<void> {
        if (!window.confirm(LANG('server-projects-delete-confirm'))) return;
        try {
            await this.store.clear(project.id);
            await this.refresh();
        } catch (error) {
            this.reportError(error);
        }
    }

    private defaultName(): string {
        return `Untitled ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
    }

    private reportError(error: unknown): void {
        window.alert(`${LANG('server-projects-failed')}: ${error instanceof Error ? error.message : error}`);
    }

    getElement(): HTMLElement { return this.root; }
}
