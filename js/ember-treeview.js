(function() {

    // Ember Tree
    Ember.Tree = Ember.Namespace.create();

    // Ember Tree Node
    Ember.Tree.Node = Ember.ObjectProxy.extend({
        label: null,
        isActive: false,
        isSelected: false,
        isOpened: false,
        parent: null,
        children: [],

        isVisible: function() {
            return this._hierarchyIsVisible(this);
        }.property('isRoot', 'parent', 'parent.isVisible', 'parent.isOpened'),

        isVisibleUnderRoot: function() {
            return this._hierarchyIsVisible(this, true);
        }.property('parent.isRoot', 'parent', 'parent.isVisible', 'parent.isOpened'),

        _hierarchyIsVisible: function(node, underRoot) {
            if (!underRoot && node.get('isRoot') || underRoot && node.get('parent.isRoot')) {
                return true;
            }

            return node.get('parent.isOpened') && this._hierarchyIsVisible(node.get('parent'), underRoot);
        },

        level: function() {
            return this._computeLevel(this.get('parent'), 0);
        }.property().volatile(),

        isRoot: function() {
            return this.get('parent') === null;
        }.property('parent'),

        isBranch: function() {
            return this.get('children').length > 0;
        }.property('children', 'children.@each'),

        isLeaf: function() {
            return !this.get('children').length;
        }.property('children', 'children.@each'),

        _computeLevel: function(node, level) {
            if (null !== node) {
                return this._computeLevel(node.get('parent'), level+1);
            }

            return level;
        }
    });

    // Mixins
    /**
     * Ember.StyleBindingsMixin
     * CREDITS for this one to Addepar EmberTable
     */
    Ember.StyleBindingsMixin = Ember.Mixin.create({
        concatenatedProperties: ['styleBindings'],
        attributeBindings: ['style'],
        unitType: 'px',
        createStyleString: function(styleName, property) {
            var value;
            value = this.get(property);
            if (value === void 0) {
                return;
            }
            if (Ember.typeOf(value) === 'number') {
                value = value + this.get('unitType');
            }
            return "" + styleName + ":" + value + ";";
        },
        applyStyleBindings: function() {
            var lookup, properties, styleBindings, styleComputed, styles,
                _this = this;
            styleBindings = this.styleBindings;
            if (!styleBindings) {
                return;
            }
            lookup = {};
            styleBindings.forEach(function(binding) {
                var property, style, _ref;
                _ref = binding.split(':'), property = _ref[0], style = _ref[1];
                return lookup[style || property] = property;
            });
            styles = Ember.keys(lookup);
            properties = styles.map(function(style) {
                return lookup[style];
            });
            styleComputed = Ember.computed(function() {
                var styleString, styleTokens;
                styleTokens = styles.map(function(style) {
                    return _this.createStyleString(style, lookup[style]);
                });
                styleString = styleTokens.join('');
                if (styleString.length !== 0) {
                    return styleString;
                }
            });
            styleComputed.property.apply(styleComputed, properties);
            return Ember.defineProperty(this, 'style', styleComputed);
        },
        init: function() {
            this.applyStyleBindings();
            return this._super();
        }
    });

    // Utils
    function _moveNode(controller, overingNode, oldPosition, oldParent, newPosition, newParent) {

        if (controller.isDropAllowed(overingNode, newParent)) {

            // Node doesn't belongs to its old parent anymore
            if (overingNode.get('parent')) {
                overingNode.get('parent.children').removeObject(overingNode);
            }

            if (!newParent.get('isOpened')) {
                newParent.set('isOpened', true);
                controller.nodeOpenStateChanged(newParent);
            }
            overingNode.set('parent', newParent);
            newParent.get('children').insertAt(newPosition, overingNode);

            controller.nodeMoved(overingNode, oldPosition, oldParent, newPosition, newParent);
        }
    };

    function _getNodeFromDOM($element) {

        var emberView = Ember.View.views[$element.attr('id')];
        if (!emberView) {
            return $element;
        }

        if (emberView.get('node') instanceof Ember.Tree.Node) {
            return emberView.get('node')
        }

        return emberView;
    };

    // Controllers
    Ember.Tree.TreeController = Ember.Controller.extend({

        // Configuration
        dragAndDrop: true,
        treeNodeContainerViewClass: 'Ember.Tree.TreeNodeContainer',
        treeNodeViewClass: 'Ember.Tree.TreeNode',
        treeNodeAfterViewClass: 'Ember.Tree.TreeNodeAfter',
        displayRootElement: false,

        treeContent: [],
        
        selectedNodes: function() {
            return this.get('treeContent').filterProperty('isSelected', true);
        }.property('treeContent.@each.isSelected'),

        _isDescendantOf: function(descendant, parent) {
            if (!descendant || !parent || this.get('displayRootElement') && null === descendant.get('parent') || !this.get('displayRootElement') && descendant.get('parent.isRoot')) {
                return false;
            }

            return descendant.get('parent') === parent ? true : this._isDescendantOf(descendant.get('parent'), parent);
        },

        isDropAllowed: function(overingNode, targetNode) {
            if (!(overingNode instanceof Ember.Tree.Node)) {
                return false;
            }

            if (targetNode === overingNode) {
                return false;
            }

            return !this._isDescendantOf(targetNode, overingNode);
        },            
            
        _lastNodeClicked: null,

        /**
         * @method nodeDropped
         *
         * @param {Ember.View}
         * @param {Number} position
         * @param {Ember.Tree.TreeNode} parent
         */
        elementDropped: Ember.K,

        /**
         * @method nodeMoved
         *
         * @param {Ember.Tree.TreeNode} node
         * @param {Number} oldPosition
         * @param {Ember.Tree.TreeNode} oldParent
         * @param {Number} newPosition
         * @param {Ember.Tree.TreeNode} newParent
         */
        nodeMoved: Ember.K,

        /**
         * @method nodeSelectionStateChanged
         * @param {Ember.Tree.TreeNode} node
         */
        nodeSelectionStateChanged: Ember.K,

        /**
         * @method nodeOpenStateChanged
         * @param {Ember.Tree.TreeNode} node
         */
        nodeOpenStateChanged: Ember.K,

        /**
         * @method nodeActiveStateChanged
         * @param {Ember.Tree.TreeNode} node
         */
        nodeActiveStateChanged: Ember.K
    });

    // Views
    Ember.Tree.TreeContainer = Ember.CollectionView.extend({

        controller: null,
        nodes: Ember.computed.alias('controller.treeContent'),
        itemViewClass: Ember.computed.alias('controller.treeNodeContainerViewClass'),
        displayRootElement: Ember.computed.alias('controller.displayRootElement'),
        classNames: ['tree-container'],

        emptyView: function() {
            return Ember.get('Ember.Tree.TreeNodeEmptyView');
        }.property(),

        content: function() {
            var tree = [];

            var root = this.get('nodes').findProperty('isRoot', true);

            if (!root) {
                return tree;
            }

            if (this.get('displayRootElement')) {
                tree.pushObject(root);
            }

            this._flattenTree(tree, root);

            return tree;
        }.property('nodes', 'nodes.@each'),

        _flattenTree: function(tree, node) {
            node.get('children').forEach(function(childNode) {
                tree.pushObject(childNode);
                this._flattenTree(tree, childNode);
            }, this);
        }
    });

    Ember.Tree.TreeNodeContainer = Ember.View.extend(Ember.StyleBindingsMixin, {
        defaultTemplate: Ember.Handlebars.compile('{{view view.treeNodeView}} {{view view.treeNodeAfterView}}'),
        classNames: ['tree-node-container'],
        displayRootElement: Ember.computed.alias('controller.displayRootElement'),

        treeNodeView: function() {
            return Ember.get(this.get('controller.treeNodeViewClass'));
        }.property('controller.treeNodeViewClass'),

        treeNodeAfterView: function() {
            return Ember.get(this.get('controller.treeNodeAfterViewClass'));
        }.property('controller.treeNodeAfterViewClass'),

        styleBindings:  ['indentation:padding-left'],

        indentation: function() {
            return (this.get('node.level') - (this.get('displayRootElement') ? 0 : 1) ) * 20 + 'px';
        }.property('node.level'),

        nodes: Ember.computed.alias('controller.treeContent'),
        node: Ember.computed.alias('content'),
        selectedNodes: Ember.computed.alias('controller.selectedNodes'),
        _lastNodeClicked: Ember.computed.alias('controller._lastNodeClicked'),

        // Events
        mouseEnter: function() {
            this.get('node').set('isActive', true);
            this.get('controller').nodeActiveStateChanged(this.get('node'));
        },

        mouseLeave: function() {
            this.get('node').set('isActive', false);
            this.get('controller').nodeActiveStateChanged(this.get('node'));
        },

        doubleClick: function() {
            //TODO: prevent click if double click is detected
            this.get('node').toggleProperty('isOpened');
        },

        click: function(event) {
            
            var node = this.get('node'),
                nodes = this.get('nodes'),
                lastNodeClicked = this.get('_lastNodeClicked'),
                selectedNodes = this.get('selectedNodes');

            if (!event.ctrlKey && !event.shiftKey) {
                var currentNode = node;
                nodes.forEach(function(node) {
                    if (node !== currentNode) {
                        node.set('isSelected', false);
                    }
                });
            }
            
            if (event.shiftKey) {
                if (lastNodeClicked && lastNodeClicked.get('isSelected')) {
                    var lastNodeClickedIndex = nodes.indexOf(lastNodeClicked),
                        nodeClickedIndex = nodes.indexOf(node);
                
                    nodes.forEach(function(node, index) {
                        if (lastNodeClickedIndex < nodeClickedIndex && index >= lastNodeClickedIndex && index <= nodeClickedIndex || lastNodeClickedIndex > nodeClickedIndex && index <= lastNodeClickedIndex && index >= nodeClickedIndex) {
                            node.set('isSelected', true);
                        }
                    }, this);
                }
            } else {
                if (selectedNodes.length > 1) {
                    node.set('isSelected', true);
                } else {
                    node.toggleProperty('isSelected');
                }
            }
            
            this.set('_lastNodeClicked', node);

            Ember.run.next(this, function() {
                this.get('controller').nodeSelectionStateChanged(node);
            });
        }
    });

    Ember.Tree.DroppableMixin = Ember.Mixin.create({
        didInsertElement: function() {
            this._super(arguments);
            this.$().droppable({
                tolerance: 'pointer',
                drop: Ember.$.proxy(this.onNodeDropped, this),
                over: Ember.$.proxy(this.onNodeOver, this),
                out: Ember.$.proxy(this.onNodeOut, this)
            });
        },

        onNodeOut: function() {
            this.$().removeClass('drag-over drag-forbidden');
        },

        onNodeDropped: function(event, ui) {
            this.$().removeClass('drag-over drag-forbidden');
        },

        onNodeOver: function(event, ui) {
            this.$().addClass('drag-over');
        }
    });

    Ember.Tree.TreeNodeView = Ember.View.extend(Ember.Tree.DroppableMixin, {
        node: Ember.computed.alias('parentView.node'),

        isVisible: function() {
            return this.get('displayRootElement') && this.get('node.isVisible') || !this.get('displayRootElement') && this.get('node.isVisibleUnderRoot');
        }.property('displayRootElement', 'node.parent.isRoot', 'node.isVisible', 'node.isVisibleUnderRoot'),

        displayRootElement: Ember.computed.alias('controller.displayRootElement')
    });

    Ember.Tree.TreeNode = Ember.Tree.TreeNodeView.extend({

        defaultTemplate: Ember.Handlebars.compile('{{view view.treeNodeHeader}} <span class="node-content">{{view.nodeContent}}</span>'),
        classNames: ['tree-node'],
        classNameBindings: ['node.isActive', 'node.isSelected', 'node.isBranch', 'node.isOpened:is-opened:is-closed'],

        nodeContent: function() {
            return this.get('node.label');
        }.property('node.label'),

        didInsertElement: function() {
            this._super(arguments);
            this.$().draggable({
                appendTo: 'body',
                helper: function() {
                    return Ember.$('<span/>').append(Ember.$('.node-content', this).html());
                }
            });
        },

        onNodeDropped: function(event, ui) {
            this._super(arguments);

            var overingNode = _getNodeFromDOM(ui.draggable),
                controller = this.get('controller'),
                newPosition = this.get('node.children').length,
                newParent = this.get('node');

            // Node to move
            if (overingNode instanceof Ember.Tree.Node) {
                var oldPosition = overingNode.get('parent.children').indexOf(overingNode),
                    oldParent = overingNode.get('parent');

                if (oldParent === newParent) {
                    return;
                }

                Ember.run.scheduleOnce('afterRender', this, function() {
                    _moveNode(controller, overingNode, oldPosition, oldParent, newPosition, newParent);
                });
            }

            controller.elementDropped(overingNode, newPosition, newParent);
        },

        onNodeOver: function(event, ui) {
            this._super(arguments);
            var targetNode = this.get('node'),
                overingNode = _getNodeFromDOM(ui.draggable),
                controller = this.get('controller');

            if (controller.isDropAllowed(overingNode, targetNode)) {
                /*if (!this.get('isOpened')) {
                    this.set('timer', Ember.run.later(targetNode, function(){
                        this.set('isOpened', true);
                    }, 500));
                }*/
            } else {
                this.$().addClass('drag-forbidden');
            }
        },

        /*onNodeOut: function(event, ui) {
            this._super(arguments);

            if (this.get('timer')) {
                Ember.run.cancel(this.get('timer'));
                this.set('timer', null);
            }
        },

        timer: null,*/

        treeNodeHeader: Ember.View.extend({
            node: Ember.computed.alias('parentView.node'),
            classNames: ['tree-node-header'],
            click: function(event) {
                event.stopPropagation();
                this.get('node').toggleProperty('isOpened');
                this.get('controller').nodeOpenStateChanged(this.get('node'));
            }
        })
    });

    /**
     * Target area displayed after each node
     */
    Ember.Tree.TreeNodeAfter = Ember.Tree.TreeNodeView.extend({
        classNames: ['drop-after-node'],

        onNodeDropped: function(event, ui) {
            this._super(arguments);

            var controller = this.get('controller'),
                overingNode = _getNodeFromDOM(ui.draggable),
                targetNode = this.get('node'),
                newPosition = targetNode.get('parent.children').indexOf(targetNode),
                newParent = targetNode.get('parent');

            if (overingNode instanceof Ember.Tree.Node) {
                var oldPosition = overingNode.get('parent.children').indexOf(overingNode),
                    oldParent = overingNode.get('parent');

                if (oldParent !== newParent || oldPosition > newPosition) {
                    newPosition++;
                }

                Ember.run.scheduleOnce('afterRender', this, function() {
                    _moveNode(controller, overingNode, oldPosition, oldParent, newPosition, newParent);
                });
            }

            controller.elementDropped(overingNode, newPosition, newParent);
        },

        onNodeOver: function(event, ui) {
            this.$().addClass('drag-over');

            var controller = this.get('controller'),
                overingNode = _getNodeFromDOM(ui.draggable),
                targetNode = this.get('node');

            if (!controller.isDropAllowed(overingNode, targetNode.get('parent'))) {
                this.$().addClass('drag-forbidden');
            }
        }
    });

    Ember.Tree.TreeNodeEmptyView = Ember.View.extend(Ember.Tree.DroppableMixin, {
        classNames: ['empty-drop-area'],

        onNodeDropped: function(event, ui) {
            this._super(arguments);

            var controller = this.get('controller'),
                overingNode = _getNodeFromDOM(ui.draggable),
                newParent = Ember.Tree.Node.create();

            controller.elementDropped(overingNode, 0, newParent);
        },

        onNodeOver: function(event, ui) {
            this._super(arguments);

            var controller = this.get('controller'),
                overingNode = _getNodeFromDOM(ui.draggable);

            if (!controller.isDropAllowed(overingNode, Ember.Tree.Node.create())) {
                this.$().addClass('drag-forbidden');
            }
        }
    });

})();
