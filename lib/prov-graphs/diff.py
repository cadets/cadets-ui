import collections

mat_elm = collections.namedtuple("mat_elm", ["pos", "val", "base_n", "new_n"])


class Node():
    def __init__(self, nid, n_type, name, out_deg, in_deg):
        self.nid = nid
        self.n_type = n_type
        self.name = name
        self.out_deg = out_deg
        self.in_deg = in_deg

    def _get_diff(self, b):
        ret = []
        if self.n_type == b.n_type:
            ret += [0.0]
        else:
            ret += [1.0]

        if self.name == b.name:
            ret += [0.0]
        else:
            ret += [1.0]

        in_diff = abs(self.in_deg-b.in_deg)
        out_diff = abs(self.out_deg-b.out_deg)
        ret += [in_diff/(1.0+in_diff)]
        ret += [out_diff/(1.0+out_diff)]

        return ret

    def diff(self, b):
        diffs = self._get_diff(b)
        val = sum(diffs)/len(diffs)
        print("Diff: {} vs {} = {}".format(self.nid, b.nid, val))
        return val

    def render(self):
        return {'id': self.nid,
                'type': self.n_type,
                'name': self.name}


def build_mat(base, new):
    return [[mat_elm((x, y),
                     node_b.diff(node_n),
                     node_b,
                     node_n)
             for y, node_n in enumerate(new)]
            for x, node_b in enumerate(base)]


def matrixmin(mat):
    return min(min(mat,
                   key=lambda col: min(col,
                                       key=lambda elm: elm.val).val),
               key=lambda elm: elm.val)


def matrixnull(mat, elm):
    ''' Null a single element of the matrix.'''
    mat[elm.pos[0]][elm.pos[1]] = mat_elm(elm.pos, 2**32, None, None)


def matrixremove(mat, elm):
    ''' Kill the row and column and element is on. '''
    for col in mat:
        tmp = col[elm.pos[1]]
        col[elm.pos[1]] = mat_elm(tmp.pos, 2**32, None, None)
    for i in range(len(mat[elm.pos[0]])):
        tmp = mat[elm.pos[0]][i]
        mat[elm.pos[0]][i] = mat_elm(tmp.pos, 2**32, None, None)


def non_aligned(nodes):
    x = set()
    y = set()
    for elm in nodes:
        x.add(elm.pos[0])
        y.add(elm.pos[1])
    return len(x) == len(nodes) == len(y)


def get_matching(base_d, new_d, base_render=True):
    out = []

    mat = build_mat(base_d, new_d)

    while True:
        cur = [matrixmin(mat)]

        if cur[0].val == 2**32:
            break
        matrixnull(mat, cur[0])

        while True:
            next_min = matrixmin(mat)
            if next_min.val == cur[0].val:
                cur += [next_min]
                matrixnull(mat, next_min)
            else:
                print("min group found")
                break

        if non_aligned(cur):
            for elm in cur:
                if base_render:
                    o_node = elm.base_n.render()
                else:
                    o_node = elm.new_n.render()
                o_node['bid'] = elm.base_n.nid
                o_node['nid'] = elm.new_n.nid
                if(elm.base_n.n_type == elm.new_n.n_type and
                   elm.base_n.name == elm.new_n.name):
                    o_node['chg'] = 'none'
                else:
                    o_node['chg'] = 'mod'
                out.append(o_node)

                matrixremove(mat, elm)
        else:
            print("Error: Ambiguous match, aborting for now.")
            return

    base_assigned = set([n['bid'] for n in out])

    base_remain = [elm for elm in base_d if elm.nid not in base_assigned]

    for elm in base_remain:
        o_node = elm.render()
        o_node['chg'] = 'del'
        o_node['bid'] = elm.nid
        o_node['nid'] = None
        out.append(o_node)

    new_assigned = set([n['nid'] for n in out])

    new_remain = [elm for elm in new_d if elm.nid not in new_assigned]

    for elm in new_remain:
        o_node = elm.render()
        o_node['chg'] = 'add'
        o_node['bid'] = None
        o_node['nid'] = elm.nid
        out.append(o_node)

    return out

m = get_matching([Node('a', 'proc', '/bin/bash', 1, 2),
                  Node('b', 'file', 'foo.txt', 1, 1),
                  Node('c', 'file', 'bar.txt', 1, 1),
                  Node('d', 'file', 'baz.txt', 1, 0),
                  Node('e', 'proc', '/bin/vim', 0, 2)],
                 [Node(1, 'proc', '/bin/bash', 1, 1),
                  Node(2, 'file', 'foo.txt', 1, 1),
                  Node(3, 'file', 'bar.txt', 1, 0),
                  Node(4, 'proc', '/bin/vim', 0, 1)])
