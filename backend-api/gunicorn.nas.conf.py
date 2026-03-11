# ==============================================================================
# Gunicorn configuration — Synology D720+ NAS (Intel Celeron J4025, Gemini Lake)
# ==============================================================================
# Problem: J4025 has no AVX support. TensorFlow 2.x and PyTorch 2.x require
# AVX instructions and cause SIGILL when imported, killing every gunicorn worker.
#
# Fix: Register stub modules in sys.modules BEFORE workers fork.
# Workers inherit sys.modules from the master process (pre-fork model).
# When app code does `import tensorflow`, Python returns the stub from
# sys.modules instead of loading the real AVX-compiled extension.
#
# Side effects:
#   - Computer vision routes return TENSORFLOW_AVAILABLE=False errors (expected)
#   - Voice assistant routes return TORCH_AVAILABLE=False errors (expected)
#   - All other routes work normally
# ==============================================================================

import sys
import logging

logger = logging.getLogger("gunicorn.error")


class _NasStub:
    """
    Silent stub module — absorbs any attribute access, calls, and indexing.
    Allows try/except ImportError blocks to succeed without loading AVX libraries.
    """
    __version__ = "0.0.0-nas-stub"
    __all__ = []
    __spec__ = None
    __path__ = []
    __file__ = None
    __package__ = "nas_stub"

    def __getattr__(self, name):
        return _NasStub()

    def __call__(self, *args, **kwargs):
        return _NasStub()

    def __getitem__(self, key):
        return _NasStub()

    def __setitem__(self, key, value):
        pass

    def __iter__(self):
        return iter([])

    def __len__(self):
        return 0

    def __bool__(self):
        return False

    def __repr__(self):
        return "<NAS-stub: AVX library disabled on J4025>"

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    # Common numeric operations needed by some ML code
    def __add__(self, other): return _NasStub()
    def __mul__(self, other): return _NasStub()
    def __sub__(self, other): return _NasStub()


# ==============================================================================
# Stub TensorFlow and all known sub-modules
# ==============================================================================
_TF_STUBS = [
    "tensorflow",
    "tensorflow.keras",
    "tensorflow.keras.layers",
    "tensorflow.keras.models",
    "tensorflow.keras.applications",
    "tensorflow.keras.applications.mobilenet_v2",
    "tensorflow.keras.preprocessing",
    "tensorflow.keras.preprocessing.image",
    "tensorflow.keras.callbacks",
    "tensorflow.keras.optimizers",
    "tensorflow.keras.losses",
    "tensorflow.keras.metrics",
    "tensorflow.keras.regularizers",
    "tensorflow.python",
    "tensorflow.python.framework",
    "tensorflow.python.ops",
    "tensorflow.compat",
    "tensorflow.compat.v1",
    "tensorflow.compat.v2",
    "tensorflow.data",
    "tensorflow.math",
    "tensorflow.linalg",
    "tensorflow.io",
    "tensorflow.image",
    "tensorflow.lite",
]

# ==============================================================================
# Stub PyTorch and all known sub-modules
# ==============================================================================
_TORCH_STUBS = [
    "torch",
    "torch.nn",
    "torch.nn.functional",
    "torch.nn.modules",
    "torch.optim",
    "torch.optim.lr_scheduler",
    "torch.utils",
    "torch.utils.data",
    "torch.cuda",
    "torch.autograd",
    "torchaudio",
    "torchvision",
    "torchvision.transforms",
    "torchvision.models",
    "torchvision.datasets",
]

# ==============================================================================
# Stub Julia-related packages (belt + suspenders alongside PYSR_USE_NUMPY=true)
# ==============================================================================
_JULIA_STUBS = [
    "juliacall",
    "juliapkg",
]

_ALL_STUBS = _TF_STUBS + _TORCH_STUBS + _JULIA_STUBS

_stubbed = []
for _mod_name in _ALL_STUBS:
    if _mod_name not in sys.modules:
        sys.modules[_mod_name] = _NasStub()
        _stubbed.append(_mod_name)

if _stubbed:
    logger.info(
        f"[NAS J4025 stub] Registered {len(_stubbed)} stub modules "
        f"(TF/PyTorch/Julia disabled — no AVX on Celeron J4025)"
    )

# ==============================================================================
# Standard gunicorn settings
# ==============================================================================
# These override or complement the CLI arguments in docker-compose.euralis.nas.yml

# Worker timeout (seconds before gunicorn kills a worker)
timeout = 120

# Keepalive
keepalive = 5

# Access log format
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(T)ss'

# Preload the app in the master process (before forking) so all workers
# inherit the already-imported modules (including stub sys.modules entries).
# This is the key that ensures stubs are inherited by forked workers.
preload_app = True
