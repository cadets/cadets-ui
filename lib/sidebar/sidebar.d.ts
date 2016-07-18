import { Message } from 'phosphor-messaging';
import { IChangedArgs } from 'phosphor-properties';
import { ISignal } from 'phosphor-signaling';
import { Title, Widget } from 'phosphor-widget';
import './sidebar.css';
/**
 * A widget which displays titles as a row of exclusive buttons.
 */
export declare class SideBar extends Widget {
    /**
     * Create the DOM node for a side bar.
     */
    static createNode(): HTMLElement;
    /**
     * Construct a new side bar.
     */
    constructor();
    /**
     * Dispose of the resources held by the widget.
     */
    dispose(): void;
    /**
     * A signal emitted when the current side bar title is changed.
     */
    currentChanged: ISignal<SideBar, IChangedArgs<Title>>;
    /**
     * Get the currently selected side bar title.
     */
    /**
     * Set the currently selected side bar title.
     */
    currentTitle: Title;
    /**
     * Get the content node which holds the side bar buttons.
     *
     * #### Notes
     * Modifying this node can lead to undefined behavior.
     *
     * This is a read-only property.
     */
    contentNode: HTMLElement;
    /**
     * Get the number of title objects in the side bar.
     *
     * @returns The number of title objects in the side bar.
     */
    titleCount(): number;
    /**
     * Get the title object at the specified index.
     *
     * @param index - The index of the title object of interest.
     *
     * @returns The title at the specified index, or `undefined`.
     */
    titleAt(index: number): Title;
    /**
     * Get the index of the specified title object.
     *
     * @param title - The title object of interest.
     *
     * @returns The index of the specified title, or `-1`.
     */
    titleIndex(title: Title): number;
    /**
     * Add a title object to the end of the side bar.
     *
     * @param title - The title object to add to the side bar.
     *
     * #### Notes
     * If the title is already added to the side bar, it will be moved.
     */
    addTitle(title: Title): void;
    /**
     * Insert a title object at the specified index.
     *
     * @param index - The index at which to insert the title.
     *
     * @param title - The title object to insert into to the side bar.
     *
     * #### Notes
     * If the title is already added to the side bar, it will be moved.
     */
    insertTitle(index: number, title: Title): void;
    /**
     * Remove a title object from the side bar.
     *
     * @param title - The title object to remove from the side bar.
     *
     * #### Notes
     * If the title is not in the side bar, this is a no-op.
     */
    removeTitle(title: Title): void;
    /**
     * Handle the DOM events for the side bar.
     *
     * @param event - The DOM event sent to the side bar.
     *
     * #### Notes
     * This method implements the DOM `EventListener` interface and is
     * called in response to events on the side bar's DOM node. It should
     * not be called directly by user code.
     */
    handleEvent(event: Event): void;
    /**
     * A message handler invoked on an `'after-attach'` message.
     */
    protected onAfterAttach(msg: Message): void;
    /**
     * A message handler invoked on a `'before-detach'` message.
     */
    protected onBeforeDetach(msg: Message): void;
    /**
     * A message handler invoked on an `'update-request'` message.
     */
    protected onUpdateRequest(msg: Message): void;
    /**
     * Handle the `'mousedown'` event for the side bar.
     */
    private _evtMouseDown(event);
    /**
     * Handle the `changed` signal of a title object.
     */
    private _onTitleChanged();
    private _dirty;
    private _titles;
}
